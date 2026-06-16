import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { EngineeringService } from '../engineering/engineering.service';
import { InventoryService } from '../inventory/inventory.service';
import { WorkOrder } from './work-order.entity';
import { PurchaseRequisition } from './purchase-requisition.entity';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

interface SoLineRow {
  id: string;
  part_id: string;
  qty: string;
  promised_date: string | null;
  project_id: string | null;
}

export interface MrpResult {
  mrpRunId: string;
  soLinesPlanned: number;
  workOrders: Array<{ id: string; number: string; partId: string; qty: number }>;
  requisitions: Array<{ id: string; itemId: string; qty: number; soLineId: string }>;
}

/**
 * MRP run (SM-140) — pure make-to-order. For each released SO line:
 *  - create one planned work order pegged to the line (top-level part);
 *  - explode the part's multi-level BOM, net the gross item demand against
 *    free on-hand and open on-order, and emit pegged purchase requisitions
 *    for the shortfall.
 * Shared supply is consumed across lines within the run (no double counting).
 * Re-runnable: planned WOs and un-ordered requisitions for the lines in scope
 * are cleared first, so a re-run reproduces a clean plan. Once a WO is released
 * the line moves to in_production and is no longer picked up.
 */
@Injectable()
export class MrpService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
    private readonly engineering: EngineeringService,
    private readonly inventory: InventoryService,
  ) {}

  async run(s: Scope): Promise<MrpResult> {
    const mrpRunId = randomUUID();
    return this.db.transaction(async (em) => {
      const soLines = (await em.query(
        `SELECT sl.id, sl.part_id, sl.qty, sl.promised_date, so.project_id
           FROM so_line sl JOIN sales_order so ON so.id = sl.sales_order_id
          WHERE so.plant_id = $1 AND sl.status = 'released_to_plan' AND sl.part_id IS NOT NULL
          ORDER BY sl.promised_date NULLS LAST`,
        [s.plantId],
      )) as SoLineRow[];

      const result: MrpResult = { mrpRunId, soLinesPlanned: soLines.length, workOrders: [], requisitions: [] };

      // running supply, consumed across lines within this run
      const freeOnHand = new Map<string, number>();
      const openOnOrder = new Map<string, number>();
      const avail = async (itemId: string) => {
        if (!freeOnHand.has(itemId)) freeOnHand.set(itemId, await this.inventory.availableOnHand(em, s.plantId, itemId));
        return freeOnHand.get(itemId)!;
      };
      const onOrder = async (itemId: string) => {
        if (!openOnOrder.has(itemId)) openOnOrder.set(itemId, await this.inventory.onOrder(em, s.plantId, itemId));
        return openOnOrder.get(itemId)!;
      };

      for (const line of soLines) {
        // re-runnable: clear the previous plan for this line
        await em.query(`DELETE FROM work_order WHERE so_line_id = $1 AND status = 'planned'`, [line.id]);
        await em.query(`DELETE FROM purchase_requisition WHERE so_line_id = $1 AND is_ordered = false`, [line.id]);

        const qty = Number(line.qty);
        const number = await this.docSeq.allocate(s.plantId, 'WO', em);
        const wo = em.create(WorkOrder, {
          orgId: s.orgId,
          plantId: s.plantId,
          number,
          soLineId: line.id,
          projectId: line.project_id ?? undefined,
          partId: line.part_id,
          qty,
          status: 'planned',
          dueDate: line.promised_date ?? undefined,
          createdBy: s.userId,
          updatedBy: s.userId,
        });
        await em.save(wo);
        result.workOrders.push({ id: wo.id, number, partId: line.part_id, qty });

        const requirements = await this.engineering.explodeItems(s.orgId, line.part_id, qty);
        for (const req of requirements) {
          const fromHand = Math.min(await avail(req.itemId), req.qtyRequired);
          freeOnHand.set(req.itemId, round3((await avail(req.itemId)) - fromHand));
          const afterHand = round3(req.qtyRequired - fromHand);

          const fromOrder = Math.min(await onOrder(req.itemId), afterHand);
          openOnOrder.set(req.itemId, round3((await onOrder(req.itemId)) - fromOrder));
          const net = round3(afterHand - fromOrder);

          if (net > 0) {
            const pr = em.create(PurchaseRequisition, {
              plantId: s.plantId,
              itemId: req.itemId,
              qty: net,
              requiredDate: line.promised_date ?? undefined,
              soLineId: line.id,
              mrpRunId,
              isOrdered: false,
            });
            await em.save(pr);
            result.requisitions.push({ id: pr.id, itemId: req.itemId, qty: net, soLineId: line.id });
          }
        }
      }
      return result;
    });
  }

  listRequisitions(plantId: string, filter: { ordered?: string }): Promise<PurchaseRequisition[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.ordered === 'true' || filter.ordered === 'false') where.isOrdered = filter.ordered === 'true';
    return this.db.getRepository(PurchaseRequisition).find({ where, order: { createdAt: 'DESC' }, take: 500 });
  }

  /** Used by procurement when a requisition is consumed onto a PO. */
  async markRequisitionsOrdered(em: EntityManager, ids: string[]): Promise<void> {
    if (ids.length) await em.query(`UPDATE purchase_requisition SET is_ordered = true WHERE id = ANY($1)`, [ids]);
  }
}
