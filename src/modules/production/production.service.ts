import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { LaborEntry } from './labor-entry.entity';
import { DowntimeEvent } from './downtime-event.entity';
import { BlockedException } from '../../common/exceptions/blocked.exception';
import { ClockOffDto, ClockOnDto, StartDowntimeDto } from './dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

@Injectable()
export class ProductionService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Clock on to a WO operation (SM-153). One active operation per operator. */
  async clockOn(s: Scope, dto: ClockOnDto) {
    return this.db.transaction(async (em) => {
      const rows = (await em.query(
        `SELECT wop.id, wop.status AS op_status, wo.id AS wo_id, wo.status AS wo_status
           FROM wo_operation wop JOIN work_order wo ON wo.id = wop.work_order_id
          WHERE wop.id = $1 AND wo.plant_id = $2`,
        [dto.woOperationId, s.plantId],
      )) as Array<{ id: string; op_status: string; wo_id: string; wo_status: string }>;
      const op = rows[0];
      if (!op) throw new NotFoundException('Work order operation not found');
      if (!['released', 'in_progress'].includes(op.wo_status)) {
        throw new BadRequestException(`Work order is '${op.wo_status}' — release it first`);
      }
      if (op.op_status === 'completed') throw new BadRequestException('Operation already completed');

      const open = (await em.query(`SELECT 1 FROM labor_entry WHERE operator_id = $1 AND clock_out IS NULL LIMIT 1`, [s.userId])) as unknown[];
      if (open.length) throw new BadRequestException('You are already clocked on to another operation');

      const le = em.create(LaborEntry, { woOperationId: dto.woOperationId, operatorId: s.userId, clockIn: new Date(), qtyGood: 0, qtyScrap: 0, rework: false });
      await em.save(le);
      if (op.op_status === 'queued') await em.query(`UPDATE wo_operation SET status = 'in_progress' WHERE id = $1`, [dto.woOperationId]);
      if (op.wo_status === 'released') await em.query(`UPDATE work_order SET status = 'in_progress', updated_by = $2 WHERE id = $1`, [op.wo_id, s.userId]);
      return { laborEntryId: le.id, woOperationId: dto.woOperationId, clockedOn: true };
    });
  }

  /** Clock off with good/scrap capture (SM-153). Scrap reason mandatory on scrap. */
  async clockOff(s: Scope, dto: ClockOffDto) {
    const qtyScrap = dto.qtyScrap ?? 0;
    if (qtyScrap > 0 && !dto.scrapReason) throw new BadRequestException('scrapReason is required when qtyScrap > 0');

    return this.db.transaction(async (em) => {
      const le = (await em.query(
        `SELECT id FROM labor_entry WHERE wo_operation_id = $1 AND operator_id = $2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`,
        [dto.woOperationId, s.userId],
      )) as Array<{ id: string }>;
      if (!le[0]) throw new BadRequestException('You are not clocked on to this operation');

      await em.query(
        `UPDATE labor_entry SET clock_out = now(), qty_good = $2, qty_scrap = $3, scrap_reason = $4, rework = $5 WHERE id = $1`,
        [le[0].id, dto.qtyGood, qtyScrap, dto.scrapReason ?? null, dto.rework ?? false],
      );
      await em.query(`UPDATE wo_operation SET qty_good = qty_good + $2, qty_scrap = qty_scrap + $3 WHERE id = $1`, [dto.woOperationId, dto.qtyGood, qtyScrap]);

      const info = (await em.query(
        `SELECT wop.op_no, wop.qty_good, wo.id AS wo_id, wo.qty, wo.plant_id, wo.part_id, wo.so_line_id,
                (SELECT MAX(op_no) FROM wo_operation WHERE work_order_id = wo.id) AS max_op
           FROM wo_operation wop JOIN work_order wo ON wo.id = wop.work_order_id WHERE wop.id = $1`,
        [dto.woOperationId],
      )) as Array<{ op_no: number; qty_good: string; wo_id: string; qty: string; plant_id: string; part_id: string; so_line_id: string; max_op: number }>;
      const r = info[0];

      let opCompleted = false;
      let woCompleted = false;
      if (Number(r.qty_good) >= Number(r.qty)) {
        await em.query(`UPDATE wo_operation SET status = 'completed' WHERE id = $1`, [dto.woOperationId]);
        opCompleted = true;
        if (Number(r.op_no) === Number(r.max_op)) {
          const scrap = (await em.query(`SELECT COALESCE(SUM(qty_scrap), 0) AS s FROM wo_operation WHERE work_order_id = $1`, [r.wo_id])) as Array<{ s: string }>;
          await em.query(
            `UPDATE work_order SET status = 'completed', qty_completed = $2, qty_scrapped = $3, updated_by = $4 WHERE id = $1`,
            [r.wo_id, r.qty_good, scrap[0].s, s.userId],
          );
          // SM-230: receive finished goods into FG stock, pegged to the SO line.
          await em.query(
            `INSERT INTO fg_stock (plant_id, part_id, so_line_id, work_order_id, qty, location)
             VALUES ($1, $2, $3, $4, $5, 'FG-STORE')`,
            [r.plant_id, r.part_id, r.so_line_id, r.wo_id, r.qty_good],
          );
          woCompleted = true;
        }
      }
      return { woOperationId: dto.woOperationId, qtyGood: dto.qtyGood, qtyScrap, opCompleted, woCompleted };
    });
  }

  /** Start a downtime period on a work center (one open at a time). */
  async startDowntime(s: Scope, dto: StartDowntimeDto) {
    const repo = this.db.getRepository(DowntimeEvent);
    const open = await repo.findOne({ where: { plantId: s.plantId, workCenterId: dto.workCenterId, endedAt: IsNull() } });
    if (open) {
      throw new BlockedException('DOWNTIME_OPEN', 'This work center already has an open downtime — end it before starting a new one.');
    }
    const ev = repo.create({
      orgId: s.orgId,
      plantId: s.plantId,
      workCenterId: dto.workCenterId,
      woOperationId: dto.woOperationId,
      reason: dto.reason,
      notes: dto.notes,
      startedAt: new Date(),
      loggedBy: s.userId,
    });
    return repo.save(ev);
  }

  /** End an open downtime period. */
  async endDowntime(s: Scope, id: string) {
    const repo = this.db.getRepository(DowntimeEvent);
    const ev = await repo.findOne({ where: { id, plantId: s.plantId } });
    if (!ev) throw new NotFoundException('Downtime event not found');
    if (!ev.endedAt) {
      ev.endedAt = new Date();
      await repo.save(ev);
    }
    return ev;
  }

  /** Currently-open downtime (for the production board). */
  openDowntime(plantId: string, workCenterId?: string) {
    return this.db.getRepository(DowntimeEvent).find({
      where: { plantId, endedAt: IsNull(), ...(workCenterId ? { workCenterId } : {}) },
      order: { startedAt: 'DESC' },
    });
  }

  /** Job traveler / router (SM-152): header + part + operations + materials + barcode. */
  async traveler(plantId: string, workOrderId: string) {
    const wo = (await this.db.query(
      `SELECT wo.number, wo.qty, wo.status, wo.due_date, p.part_no, p.rev, p.description
         FROM work_order wo JOIN part p ON p.id = wo.part_id WHERE wo.id = $1 AND wo.plant_id = $2`,
      [workOrderId, plantId],
    )) as Array<any>;
    if (!wo[0]) throw new NotFoundException('Work order not found');

    const operations = await this.db.query(
      `SELECT wop.op_no, wop.status, wc.code AS work_center, om.code AS operation, wop.is_outside
         FROM wo_operation wop
         LEFT JOIN work_center wc ON wc.id = wop.work_center_id
         LEFT JOIN routing_op ro ON ro.id = wop.routing_op_id
         LEFT JOIN operation_master om ON om.id = ro.operation_id
        WHERE wop.work_order_id = $1 ORDER BY wop.op_no`,
      [workOrderId],
    );
    const materials = await this.db.query(
      `SELECT i.code, i.name, ma.qty_allocated, ma.qty_issued
         FROM material_allocation ma JOIN stock_lot sl ON sl.id = ma.stock_lot_id JOIN item i ON i.id = sl.item_id
        WHERE ma.work_order_id = $1`,
      [workOrderId],
    );
    return {
      workOrder: { number: wo[0].number, qty: Number(wo[0].qty), status: wo[0].status, dueDate: wo[0].due_date, part: { partNo: wo[0].part_no, rev: wo[0].rev, description: wo[0].description } },
      barcode: wo[0].number,
      operations,
      materials,
    };
  }

  /** Live production board (SM-154): active jobs by work center, behind-schedule flagged. */
  async board(plantId: string, workCenterId?: string) {
    const params: unknown[] = [plantId];
    let where = `wo.plant_id = $1 AND wo.status IN ('released', 'in_progress')`;
    if (workCenterId) { params.push(workCenterId); where += ` AND wop.work_center_id = $${params.length}`; }
    const rows = (await this.db.query(
      `SELECT wop.id, wop.op_no, wop.status AS op_status, COALESCE(wc.code, 'UNASSIGNED') AS work_center,
              wo.number AS wo_number, wo.status AS wo_status, wo.due_date, p.part_no,
              (wo.due_date < current_date AND wo.status <> 'completed') AS behind_schedule
         FROM wo_operation wop JOIN work_order wo ON wo.id = wop.work_order_id
         LEFT JOIN work_center wc ON wc.id = wop.work_center_id
         JOIN part p ON p.id = wo.part_id
        WHERE ${where} ORDER BY work_center, wo_number, wop.op_no`,
      params,
    )) as Array<{ work_center: string; [k: string]: unknown }>;

    const groups = new Map<string, unknown[]>();
    for (const r of rows) {
      if (!groups.has(r.work_center)) groups.set(r.work_center, []);
      groups.get(r.work_center)!.push(r);
    }
    return [...groups].map(([workCenter, operations]) => ({ workCenter, operations }));
  }
}
