import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { round2Money as round2 } from '../../common/tax';

interface Scope {
  plantId: string;
  userId: string;
}

export interface ClosureChecklist {
  allShipped: boolean;
  invoiced: boolean;
  paid: boolean;
  accepted: boolean;
  qcClear: boolean;
  readyToClose: boolean;
}

/** Project closure (SM-166/251): readiness checklist + estimate-vs-actual roll-up + realized margin. */
@Injectable()
export class ClosureService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** SM-251: gates that must pass before a sales order can be closed. */
  async checklist(salesOrderId: string): Promise<ClosureChecklist> {
    const r = (await this.db.query(
      `SELECT
         (EXISTS(SELECT 1 FROM so_line WHERE sales_order_id = $1)
           AND NOT EXISTS(SELECT 1 FROM so_line sl WHERE sl.sales_order_id = $1
             AND (SELECT COALESCE(SUM(qty),0) FROM packing_line WHERE so_line_id = sl.id) < sl.qty)) AS "allShipped",
         EXISTS(SELECT 1 FROM invoice WHERE sales_order_id = $1 AND status <> 'cancelled') AS "invoiced",
         (EXISTS(SELECT 1 FROM invoice WHERE sales_order_id = $1 AND status <> 'cancelled')
           AND COALESCE((SELECT SUM(grand_total - amount_paid) FROM invoice WHERE sales_order_id = $1 AND status <> 'cancelled'), 0) <= 0) AS "paid",
         (EXISTS(SELECT 1 FROM shipment WHERE sales_order_id = $1)
           AND NOT EXISTS(SELECT 1 FROM shipment WHERE sales_order_id = $1 AND accepted_at IS NULL)) AS "accepted",
         NOT EXISTS(SELECT 1 FROM ncr n JOIN work_order wo ON wo.id = n.work_order_id
           JOIN so_line sl ON sl.id = wo.so_line_id WHERE sl.sales_order_id = $1 AND n.status = 'open') AS "qcClear"`,
      [salesOrderId],
    )) as Array<{ allShipped: boolean; invoiced: boolean; paid: boolean; accepted: boolean; qcClear: boolean }>;
    const c = r[0];
    return { ...c, readyToClose: c.allShipped && c.invoiced && c.paid && c.accepted && c.qcClear };
  }

  async report(plantId: string, salesOrderId: string) {
    const so = (await this.db.query(`SELECT id, number, status FROM sales_order WHERE id = $1 AND plant_id = $2`, [salesOrderId, plantId])) as Array<{ id: string; number: string; status: string }>;
    if (!so[0]) throw new NotFoundException('Sales order not found');

    const rows = (await this.db.query(
      `SELECT sl.id, sl.part_name, sl.qty, sl.unit_price,
              COALESCE(ql.material_cost,0) + COALESCE(ql.process_cost,0) + COALESCE(ql.hardware_cost,0)
                + COALESCE(ql.outside_cost,0) + COALESCE(ql.setup_cost,0) AS est_unit,
              COALESCE(act.m, 0) AS act_material, COALESCE(act.l, 0) AS act_labor
         FROM so_line sl
         LEFT JOIN quote_line ql ON ql.id = sl.quote_line_id
         LEFT JOIN (SELECT so_line_id, SUM(material_cost) AS m, SUM(labor_cost) AS l FROM v_wo_actual_cost GROUP BY so_line_id) act ON act.so_line_id = sl.id
        WHERE sl.sales_order_id = $1`,
      [salesOrderId],
    )) as Array<any>;

    const lines = rows.map((r) => {
      const qty = Number(r.qty);
      const revenue = round2(qty * Number(r.unit_price));
      const estimatedCost = round2(Number(r.est_unit) * qty);
      const actualMaterial = round2(Number(r.act_material));
      const actualLabor = round2(Number(r.act_labor));
      const actualCost = round2(actualMaterial + actualLabor);
      return {
        soLineId: r.id, partName: r.part_name, qty, revenue, estimatedCost,
        actualMaterial, actualLabor, actualCost,
        margin: round2(revenue - actualCost),
        variance: round2(estimatedCost - actualCost),
      };
    });

    const sum = (k: keyof (typeof lines)[number]) => round2(lines.reduce((a, l) => a + (l[k] as number), 0));
    const revenue = sum('revenue');
    const actualCost = sum('actualCost');
    return {
      salesOrder: so[0].number,
      status: so[0].status,
      checklist: await this.checklist(salesOrderId),
      lines,
      totals: {
        revenue,
        estimatedCost: sum('estimatedCost'),
        actualMaterial: sum('actualMaterial'),
        actualLabor: sum('actualLabor'),
        actualCost,
        realizedMargin: round2(revenue - actualCost),
        marginPct: revenue > 0 ? round2(((revenue - actualCost) / revenue) * 100) : null,
      },
    };
  }

  async close(s: Scope, salesOrderId: string) {
    const report = await this.report(s.plantId, salesOrderId);
    const c = report.checklist;
    if (!c.readyToClose) {
      const failed = [
        !c.allShipped && 'all lines shipped',
        !c.invoiced && 'invoiced',
        !c.paid && 'fully paid',
        !c.accepted && 'customer acceptance recorded',
        !c.qcClear && 'no open NCRs',
      ].filter(Boolean);
      throw new BadRequestException(`Cannot close: pending — ${failed.join(', ')}`);
    }
    await this.db.transaction(async (em) => {
      await em.query(`UPDATE sales_order SET status = 'closed', updated_by = $2 WHERE id = $1`, [salesOrderId, s.userId]);
      await em.query(`UPDATE so_line SET status = 'closed' WHERE sales_order_id = $1 AND status <> 'closed'`, [salesOrderId]);
    });
    return { ...report, status: 'closed' };
  }
}
