import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { round2Money as round2 } from '../../common/tax';

interface Scope {
  plantId: string;
  userId: string;
}

/** Project closure (SM-166): estimate-vs-actual roll-up + realized margin. */
@Injectable()
export class ClosureService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

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
    await this.db.transaction(async (em) => {
      await em.query(`UPDATE sales_order SET status = 'closed', updated_by = $2 WHERE id = $1`, [salesOrderId, s.userId]);
      await em.query(`UPDATE so_line SET status = 'closed' WHERE sales_order_id = $1 AND status <> 'closed'`, [salesOrderId]);
    });
    return { ...report, status: 'closed' };
  }
}
