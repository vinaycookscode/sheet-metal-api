import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { round2Money as round2 } from '../../common/tax';

@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

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
