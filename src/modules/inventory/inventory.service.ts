import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { StockLot } from './stock-lot.entity';
import { StockTxn } from './stock-txn.entity';
import { MaterialAllocation } from './material-allocation.entity';

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

interface ReceiptParams {
  plantId: string;
  itemId: string;
  qty: number;
  unitCost?: number;
  heatNo?: string;
  lotNo?: string;
  location?: string;
  grnLineId?: string;
  byUser?: string;
  reference?: string;
}

@Injectable()
export class InventoryService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Free stock for an item in a plant: Σ(qty_on_hand − qty_allocated). */
  async availableOnHand(em: EntityManager, plantId: string, itemId: string): Promise<number> {
    const r = (await em.query(
      `SELECT COALESCE(SUM(qty_on_hand - qty_allocated), 0) AS avail FROM stock_lot WHERE plant_id = $1 AND item_id = $2`,
      [plantId, itemId],
    )) as Array<{ avail: string }>;
    return Number(r[0].avail);
  }

  /** Open purchase quantity for an item: Σ(po_line.qty − qty_received) on live POs. */
  async onOrder(em: EntityManager, plantId: string, itemId: string): Promise<number> {
    const r = (await em.query(
      `SELECT COALESCE(SUM(pl.qty - pl.qty_received), 0) AS onorder
         FROM po_line pl JOIN purchase_order po ON po.id = pl.purchase_order_id
        WHERE po.plant_id = $1 AND pl.item_id = $2 AND po.status NOT IN ('closed', 'cancelled')`,
      [plantId, itemId],
    )) as Array<{ onorder: string }>;
    return Number(r[0].onorder);
  }

  /** Post a goods receipt: new stock lot + grn_receipt ledger txn. */
  async postReceipt(em: EntityManager, p: ReceiptParams): Promise<StockLot> {
    const lot = em.create(StockLot, {
      plantId: p.plantId,
      itemId: p.itemId,
      qtyOnHand: p.qty,
      qtyAllocated: 0,
      unitCost: p.unitCost,
      heatNo: p.heatNo,
      lotNo: p.lotNo,
      location: p.location,
      grnLineId: p.grnLineId,
      isRemnant: false,
    });
    await em.save(lot);
    await em.save(
      em.create(StockTxn, {
        plantId: p.plantId,
        stockLotId: lot.id,
        txnType: 'grn_receipt',
        qtyDelta: p.qty,
        reference: p.reference,
        byUser: p.byUser,
      }),
    );
    return lot;
  }

  /** Reserve stock for a work order, FIFO across lots. Returns allocated + shortfall. */
  async allocate(
    em: EntityManager,
    params: { workOrderId: string; plantId: string; itemId: string; qtyNeeded: number },
  ): Promise<{ allocated: number; shortfall: number }> {
    const lots = await em
      .getRepository(StockLot)
      .createQueryBuilder('l')
      .where('l.plant_id = :p AND l.item_id = :i', { p: params.plantId, i: params.itemId })
      .andWhere('l.qty_on_hand - l.qty_allocated > 0')
      .orderBy('l.created_at', 'ASC')
      .getMany();

    let remaining = params.qtyNeeded;
    let allocated = 0;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const avail = Number(lot.qtyOnHand) - Number(lot.qtyAllocated);
      const take = Math.min(avail, remaining);
      if (take <= 0) continue;
      await em.save(em.create(MaterialAllocation, { workOrderId: params.workOrderId, stockLotId: lot.id, qtyAllocated: take, qtyIssued: 0 }));
      lot.qtyAllocated = round3(Number(lot.qtyAllocated) + take);
      await em.save(lot);
      allocated = round3(allocated + take);
      remaining = round3(remaining - take);
    }
    return { allocated, shortfall: round3(Math.max(0, params.qtyNeeded - allocated)) };
  }

  listStock(plantId: string, itemId?: string): Promise<StockLot[]> {
    return this.db.getRepository(StockLot).find({
      where: { plantId, ...(itemId ? { itemId } : {}) },
      order: { createdAt: 'ASC' },
      take: 500,
    });
  }

  /** Stock balances grouped by item (SM-150). */
  async summary(plantId: string): Promise<Array<{ itemId: string; code: string; name: string; onHand: number; allocated: number; available: number }>> {
    const rows = (await this.db.query(
      `SELECT sl.item_id, i.code, i.name,
              SUM(sl.qty_on_hand) AS on_hand,
              SUM(sl.qty_allocated) AS allocated,
              SUM(sl.qty_on_hand - sl.qty_allocated) AS available
         FROM stock_lot sl JOIN item i ON i.id = sl.item_id
        WHERE sl.plant_id = $1
        GROUP BY sl.item_id, i.code, i.name
       HAVING SUM(sl.qty_on_hand) <> 0
        ORDER BY i.code`,
      [plantId],
    )) as Array<{ item_id: string; code: string; name: string; on_hand: string; allocated: string; available: string }>;
    return rows.map((r) => ({ itemId: r.item_id, code: r.code, name: r.name, onHand: Number(r.on_hand), allocated: Number(r.allocated), available: Number(r.available) }));
  }

  /** Stock movement ledger (SM-150). */
  ledger(plantId: string, filter: { itemId?: string; stockLotId?: string }): Promise<unknown[]> {
    const params: unknown[] = [plantId];
    let where = 'st.plant_id = $1';
    if (filter.stockLotId) { params.push(filter.stockLotId); where += ` AND st.stock_lot_id = $${params.length}`; }
    if (filter.itemId) { params.push(filter.itemId); where += ` AND sl.item_id = $${params.length}`; }
    return this.db.query(
      `SELECT st.id, st.txn_type, st.qty_delta, st.stock_lot_id, sl.item_id, st.work_order_id, st.reference, st.at
         FROM stock_txn st JOIN stock_lot sl ON sl.id = st.stock_lot_id
        WHERE ${where} ORDER BY st.at DESC LIMIT 500`,
      params,
    );
  }

  /** Issue all outstanding allocated material for a work order (SM-151). */
  async issueToWorkOrder(scope: { plantId: string; userId: string }, workOrderId: string): Promise<Array<{ stockLotId: string; itemId: string; qty: number }>> {
    return this.db.transaction(async (em) => {
      const wo = (await em.query(`SELECT id, status FROM work_order WHERE id = $1 AND plant_id = $2`, [workOrderId, scope.plantId])) as Array<{ id: string; status: string }>;
      if (!wo[0]) throw new NotFoundException('Work order not found');
      if (!['released', 'in_progress'].includes(wo[0].status)) {
        throw new BadRequestException(`Work order is '${wo[0].status}' — release it before issuing material`);
      }
      const allocs = (await em.query(
        `SELECT ma.id, ma.stock_lot_id, ma.qty_allocated, ma.qty_issued, sl.item_id
           FROM material_allocation ma JOIN stock_lot sl ON sl.id = ma.stock_lot_id
          WHERE ma.work_order_id = $1`,
        [workOrderId],
      )) as Array<{ id: string; stock_lot_id: string; qty_allocated: string; qty_issued: string; item_id: string }>;

      const issued: Array<{ stockLotId: string; itemId: string; qty: number }> = [];
      for (const a of allocs) {
        const toIssue = round3(Number(a.qty_allocated) - Number(a.qty_issued));
        if (toIssue <= 0) continue;
        await em.query(`UPDATE stock_lot SET qty_on_hand = qty_on_hand - $1, qty_allocated = qty_allocated - $1 WHERE id = $2`, [toIssue, a.stock_lot_id]);
        await em.query(`UPDATE material_allocation SET qty_issued = qty_allocated WHERE id = $1`, [a.id]);
        await em.save(em.create(StockTxn, { plantId: scope.plantId, stockLotId: a.stock_lot_id, txnType: 'wo_issue', qtyDelta: -toIssue, workOrderId, reference: 'WO issue', byUser: scope.userId }));
        issued.push({ stockLotId: a.stock_lot_id, itemId: a.item_id, qty: toIssue });
      }
      return issued;
    });
  }

  /** Return a remnant/offcut to stock as a tracked remnant lot (SM-151). */
  async returnRemnant(scope: { plantId: string; userId: string }, p: { workOrderId: string; itemId: string; qty: number; location?: string }): Promise<StockLot> {
    if (p.qty <= 0) throw new BadRequestException('qty must be positive');
    return this.db.transaction(async (em) => {
      const lot = await this.postReceipt(em, { plantId: scope.plantId, itemId: p.itemId, qty: p.qty, location: p.location, byUser: scope.userId, reference: `remnant WO ${p.workOrderId}` });
      lot.isRemnant = true;
      await em.save(lot);
      // tag the receipt txn type as remnant_return
      await em.query(`UPDATE stock_txn SET txn_type = 'remnant_return', work_order_id = $2 WHERE stock_lot_id = $1`, [lot.id, p.workOrderId]);
      return lot;
    });
  }

  /** Manual stock adjustment with ledger txn (SM-150). */
  async adjust(scope: { plantId: string; userId: string }, p: { stockLotId: string; qtyDelta: number; reason: string }): Promise<StockLot> {
    return this.db.transaction(async (em) => {
      const lot = await em.getRepository(StockLot).findOne({ where: { id: p.stockLotId, plantId: scope.plantId } });
      if (!lot) throw new NotFoundException('Stock lot not found');
      const next = round3(Number(lot.qtyOnHand) + p.qtyDelta);
      if (next < 0) throw new BadRequestException('Adjustment would drive stock negative');
      lot.qtyOnHand = next;
      await em.save(lot);
      await em.save(em.create(StockTxn, { plantId: scope.plantId, stockLotId: lot.id, txnType: 'adjustment', qtyDelta: p.qtyDelta, reference: p.reason, byUser: scope.userId }));
      return lot;
    });
  }
}
