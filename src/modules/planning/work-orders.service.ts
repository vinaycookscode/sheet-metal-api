import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EngineeringService } from '../engineering/engineering.service';
import { InventoryService } from '../inventory/inventory.service';
import { WorkOrder } from './work-order.entity';
import { WoOperation } from './wo-operation.entity';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly engineering: EngineeringService,
    private readonly inventory: InventoryService,
  ) {}

  list(plantId: string, filter: { status?: string }): Promise<WorkOrder[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    return this.db.getRepository(WorkOrder).find({ where, order: { createdAt: 'DESC' }, take: 500 });
  }

  async findOne(plantId: string, id: string): Promise<WorkOrder> {
    const wo = await this.db.getRepository(WorkOrder).findOne({
      where: { id, plantId },
      relations: { operations: true },
      order: { operations: { opNo: 'ASC' } },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    return wo;
  }

  /** Release a planned WO (SM-141): copy routing into wo_operations, allocate
   *  material from stock, flip the SO line/order into production. */
  async release(s: Scope, id: string): Promise<{ workOrder: WorkOrder; allocations: Array<{ itemId: string; allocated: number; shortfall: number }> }> {
    const allocations: Array<{ itemId: string; allocated: number; shortfall: number }> = [];
    await this.db.transaction(async (em) => {
      const wo = await em.getRepository(WorkOrder).findOne({ where: { id, plantId: s.plantId } });
      if (!wo) throw new NotFoundException('Work order not found');
      if (wo.status !== 'planned') throw new BadRequestException(`Work order is '${wo.status}', expected 'planned'`);

      // 1. operations from the part's routing
      const ops = (await em.query(
        `SELECT id, op_no, work_center_id, is_outside FROM routing_op WHERE part_id = $1 ORDER BY op_no`,
        [wo.partId],
      )) as Array<{ id: string; op_no: number; work_center_id: string | null; is_outside: boolean }>;
      if (!ops.length) throw new BadRequestException('Part has no routing — cannot release');
      await em.save(
        ops.map((o) =>
          em.create(WoOperation, {
            workOrderId: wo.id,
            opNo: o.op_no,
            routingOpId: o.id,
            workCenterId: o.work_center_id ?? undefined,
            isOutside: o.is_outside,
            status: 'queued',
          }),
        ),
      );

      // 2. allocate material per exploded item requirement
      const requirements = await this.engineering.explodeItems(s.orgId, wo.partId, Number(wo.qty));
      for (const req of requirements) {
        const r = await this.inventory.allocate(em, {
          workOrderId: wo.id,
          plantId: s.plantId,
          itemId: req.itemId,
          qtyNeeded: req.qtyRequired,
        });
        allocations.push({ itemId: req.itemId, allocated: r.allocated, shortfall: r.shortfall });
      }

      // 3. release WO + move the SO line / order into production
      wo.status = 'released';
      wo.releasedAt = new Date();
      wo.updatedBy = s.userId;
      await em.save(wo);
      await em.query(
        `UPDATE so_line SET status = 'in_production' WHERE id = $1 AND status = 'released_to_plan'`,
        [wo.soLineId],
      );
      await em.query(
        `UPDATE sales_order SET status = 'in_production', updated_by = $2
          WHERE id = (SELECT sales_order_id FROM so_line WHERE id = $1) AND status = 'confirmed'`,
        [wo.soLineId, s.userId],
      );
    });
    return { workOrder: await this.findOne(s.plantId, id), allocations };
  }
}
