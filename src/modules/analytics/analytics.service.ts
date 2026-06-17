import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { round2Money as round2 } from '../../common/tax';
import { LaborEntry } from '../production/labor-entry.entity';
import { DowntimeEvent } from '../production/downtime-event.entity';
import { WorkOrder } from '../planning/work-order.entity';

const pct = (n: number | null): number | null => (n == null ? null : round2(n * 100));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Production Intelligence (M18): OEE (availability×performance×quality), scrap/yield,
   * downtime-by-reason and WIP, per work-center and rolled up for the plant, over a window.
   * Built with the TypeORM QueryBuilder.
   */
  async productionIntelligence(plantId: string, from?: string, to?: string) {
    const fromD = from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
    const toD = to ?? new Date(Date.now() + 86_400_000).toISOString();

    // Labor aggregates per work centre: run time, good/scrap, "earned" time (cycle × good).
    const labor = await this.db.getRepository(LaborEntry).createQueryBuilder('le')
      .innerJoin('wo_operation', 'wop', 'wop.id = le.wo_operation_id')
      .innerJoin('work_order', 'wo', 'wo.id = wop.work_order_id')
      .leftJoin('routing_op', 'ro', 'ro.id = wop.routing_op_id')
      .leftJoin('work_center', 'wc', 'wc.id = wop.work_center_id')
      .select('wop.work_center_id', 'wcId')
      .addSelect("COALESCE(wc.code, 'UNASSIGNED')", 'workCenter')
      .addSelect('COALESCE(SUM(EXTRACT(EPOCH FROM (le.clock_out - le.clock_in))), 0)', 'runSeconds')
      .addSelect('COALESCE(SUM(le.qty_good), 0)', 'good')
      .addSelect('COALESCE(SUM(le.qty_scrap), 0)', 'scrap')
      .addSelect('COALESCE(SUM(COALESCE(ro.run_seconds_per_unit, 0) * le.qty_good), 0)', 'earnedSeconds')
      .where('wo.plant_id = :plantId', { plantId })
      .andWhere('le.clock_out IS NOT NULL')
      .andWhere('le.clock_in >= :fromD AND le.clock_in < :toD', { fromD, toD })
      .groupBy('wop.work_center_id').addGroupBy('wc.code')
      .getRawMany<{ wcId: string; workCenter: string; runSeconds: string; good: string; scrap: string; earnedSeconds: string }>();

    // Downtime per work centre + by reason.
    const dtRepo = this.db.getRepository(DowntimeEvent);
    const dur = 'EXTRACT(EPOCH FROM (COALESCE(d.ended_at, now()) - d.started_at))';
    const downtime = await dtRepo.createQueryBuilder('d')
      .leftJoin('work_center', 'wc', 'wc.id = d.work_center_id')
      .select('d.work_center_id', 'wcId')
      .addSelect("COALESCE(wc.code, 'UNASSIGNED')", 'workCenter')
      .addSelect(`COALESCE(SUM(${dur}), 0)`, 'downtimeSeconds')
      .where('d.plant_id = :plantId', { plantId })
      .andWhere('d.started_at >= :fromD AND d.started_at < :toD', { fromD, toD })
      .groupBy('d.work_center_id').addGroupBy('wc.code')
      .getRawMany<{ wcId: string; workCenter: string; downtimeSeconds: string }>();
    const dtByWc = new Map(downtime.map((d) => [d.wcId, Number(d.downtimeSeconds)]));

    const byReason = await dtRepo.createQueryBuilder('d')
      .select('d.reason', 'reason')
      .addSelect(`COALESCE(SUM(${dur}), 0)`, 'seconds')
      .addSelect('COUNT(*)', 'count')
      .where('d.plant_id = :plantId', { plantId })
      .andWhere('d.started_at >= :fromD AND d.started_at < :toD', { fromD, toD })
      .groupBy('d.reason').orderBy('seconds', 'DESC')
      .getRawMany<{ reason: string; seconds: string; count: string }>();

    // Per-work-centre OEE.
    const seen = new Set<string>();
    const workCenters = labor.map((l) => {
      seen.add(l.wcId);
      const runSeconds = Number(l.runSeconds);
      const good = Number(l.good);
      const scrap = Number(l.scrap);
      const earned = Number(l.earnedSeconds);
      const downtimeSeconds = dtByWc.get(l.wcId) ?? 0;
      const availability = runSeconds + downtimeSeconds > 0 ? runSeconds / (runSeconds + downtimeSeconds) : null;
      const performance = runSeconds > 0 && earned > 0 ? clamp01(earned / runSeconds) : null;
      const quality = good + scrap > 0 ? good / (good + scrap) : null;
      const oee = availability != null && quality != null ? availability * (performance ?? 1) * quality : null;
      return {
        workCenterId: l.wcId, workCenter: l.workCenter,
        runHours: round2(runSeconds / 3600), downtimeHours: round2(downtimeSeconds / 3600),
        good, scrap,
        availabilityPct: pct(availability), performancePct: pct(performance),
        qualityPct: pct(quality), oeePct: pct(oee),
      };
    });
    // Work centres with only downtime (no labour) in the window.
    for (const d of downtime) {
      if (seen.has(d.wcId)) continue;
      workCenters.push({
        workCenterId: d.wcId, workCenter: d.workCenter, runHours: 0,
        downtimeHours: round2(Number(d.downtimeSeconds) / 3600), good: 0, scrap: 0,
        availabilityPct: 0, performancePct: null, qualityPct: null, oeePct: null,
      });
    }

    // Plant rollup.
    const totRun = labor.reduce((a, l) => a + Number(l.runSeconds), 0);
    const totEarned = labor.reduce((a, l) => a + Number(l.earnedSeconds), 0);
    const totGood = labor.reduce((a, l) => a + Number(l.good), 0);
    const totScrap = labor.reduce((a, l) => a + Number(l.scrap), 0);
    const totDt = downtime.reduce((a, d) => a + Number(d.downtimeSeconds), 0);
    const pAvail = totRun + totDt > 0 ? totRun / (totRun + totDt) : null;
    const pPerf = totRun > 0 && totEarned > 0 ? clamp01(totEarned / totRun) : null;
    const pQual = totGood + totScrap > 0 ? totGood / (totGood + totScrap) : null;
    const pOee = pAvail != null && pQual != null ? pAvail * (pPerf ?? 1) * pQual : null;

    const wip = await this.db.getRepository(WorkOrder).createQueryBuilder('wo')
      .where('wo.plant_id = :plantId', { plantId })
      .andWhere("wo.status IN ('released', 'in_progress')")
      .getCount();

    return {
      from: fromD, to: toD,
      plant: {
        oeePct: pct(pOee), availabilityPct: pct(pAvail), performancePct: pct(pPerf), qualityPct: pct(pQual),
        scrapPct: pct(totGood + totScrap > 0 ? totScrap / (totGood + totScrap) : null),
        yieldPct: pct(pQual),
        runHours: round2(totRun / 3600), downtimeHours: round2(totDt / 3600),
        good: totGood, scrap: totScrap, wip,
      },
      workCenters,
      downtimeByReason: byReason.map((r) => ({ reason: r.reason, hours: round2(Number(r.seconds) / 3600), count: Number(r.count) })),
    };
  }

  /** Management KPIs (SM-253) — single aggregate snapshot for the plant. */
  async kpis(plantId: string) {
    const r = (await this.db.query(
      `SELECT
         (SELECT COALESCE(SUM(grand_total),0) FROM invoice WHERE plant_id = $1 AND status <> 'cancelled') AS revenue,
         (SELECT COALESCE(SUM(grand_total - amount_paid),0) FROM invoice WHERE plant_id = $1 AND status <> 'cancelled') AS ar,
         (SELECT COALESCE(SUM(grand_total - amount_paid),0) FROM supplier_invoice WHERE plant_id = $1 AND status IN ('approved','partially_paid')) AS ap,
         (SELECT COUNT(*) FROM work_order WHERE plant_id = $1 AND status IN ('planned','released','in_progress')) AS open_wo,
         (SELECT COUNT(*) FROM ncr WHERE plant_id = $1 AND status = 'open') AS open_ncr,
         (SELECT COUNT(*) FROM quote WHERE plant_id = $1) AS quotes,
         (SELECT COUNT(*) FROM sales_order WHERE plant_id = $1) AS orders,
         (SELECT COUNT(*) FROM sales_order WHERE plant_id = $1 AND status NOT IN ('closed','cancelled')) AS open_orders`,
      [plantId],
    )) as Array<{ revenue: string; ar: string; ap: string; open_wo: string; open_ncr: string; quotes: string; orders: string; open_orders: string }>;
    const k = r[0];
    const quotes = Number(k.quotes);
    const orders = Number(k.orders);
    return {
      revenue: round2(Number(k.revenue)),
      arOutstanding: round2(Number(k.ar)),
      apOutstanding: round2(Number(k.ap)),
      openWorkOrders: Number(k.open_wo),
      openNcrs: Number(k.open_ncr),
      openOrders: Number(k.open_orders),
      quotes,
      orders,
      winRatePct: quotes > 0 ? round2((orders / quotes) * 100) : null,
    };
  }

  /** Profitability per sales order (SM-252) — revenue vs actual cost → margin. */
  async profitability(plantId: string) {
    const rows = (await this.db.query(
      `SELECT so.number, c.name AS customer, so.status,
              COALESCE(SUM(sl.qty * sl.unit_price), 0) AS revenue,
              COALESCE(SUM(act.cost), 0) AS actual_cost
         FROM sales_order so
         JOIN customer c ON c.id = so.customer_id
         JOIN so_line sl ON sl.sales_order_id = so.id
         LEFT JOIN (SELECT so_line_id, SUM(material_cost + labor_cost) AS cost FROM v_wo_actual_cost GROUP BY so_line_id) act ON act.so_line_id = sl.id
        WHERE so.plant_id = $1
        GROUP BY so.id, c.name
        ORDER BY (COALESCE(SUM(sl.qty * sl.unit_price), 0) - COALESCE(SUM(act.cost), 0)) DESC
        LIMIT 50`,
      [plantId],
    )) as Array<{ number: string; customer: string; status: string; revenue: string; actual_cost: string }>;

    let totalRevenue = 0;
    let totalCost = 0;
    const orders = rows.map((r) => {
      const revenue = round2(Number(r.revenue));
      const actualCost = round2(Number(r.actual_cost));
      totalRevenue += revenue;
      totalCost += actualCost;
      const margin = round2(revenue - actualCost);
      return { number: r.number, customer: r.customer, status: r.status, revenue, actualCost, margin, marginPct: revenue > 0 ? round2((margin / revenue) * 100) : null };
    });
    const totalMargin = round2(totalRevenue - totalCost);
    return {
      orders,
      totals: { revenue: round2(totalRevenue), actualCost: round2(totalCost), margin: totalMargin, marginPct: totalRevenue > 0 ? round2((totalMargin / totalRevenue) * 100) : null },
    };
  }
}
