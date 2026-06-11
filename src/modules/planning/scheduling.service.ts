import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const r1 = (n: number) => Math.round(n * 10) / 10;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

@Injectable()
export class SchedulingService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** SM-232: open load (setup + run×remaining qty) per work center vs daily capacity. */
  async capacityBoard(plantId: string) {
    const rows = (await this.db.query(
      `SELECT wc.code, wc.name, wc.capacity_hrs_per_day AS "capHrs", wc.is_outside AS "isOutside",
              COUNT(x.id) AS "queuedOps", COALESCE(SUM(x.mins), 0) AS "loadMinutes"
         FROM work_center wc
         LEFT JOIN (
           SELECT wop.id, wop.work_center_id,
                  COALESCE(ro.setup_minutes, 0) + COALESCE(ro.run_seconds_per_unit, 0) * GREATEST(wo.qty - wo.qty_completed, 0) / 60.0 AS mins
             FROM wo_operation wop
             JOIN work_order wo ON wo.id = wop.work_order_id
             LEFT JOIN routing_op ro ON ro.id = wop.routing_op_id
            WHERE wop.status <> 'completed' AND wo.status IN ('planned','released','in_progress') AND wo.plant_id = $1
         ) x ON x.work_center_id = wc.id
        WHERE wc.plant_id = $1
        GROUP BY wc.id
        ORDER BY wc.code`,
      [plantId],
    )) as Array<{ code: string; name: string; capHrs: string; isOutside: boolean; queuedOps: string; loadMinutes: string }>;

    return rows.map((r) => {
      const loadHrs = Number(r.loadMinutes) / 60;
      const capacityHrsPerDay = Number(r.capHrs) || 8;
      const backlogDays = capacityHrsPerDay > 0 ? loadHrs / capacityHrsPerDay : 0;
      return {
        code: r.code,
        name: r.name,
        isOutside: r.isOutside,
        queuedOps: Number(r.queuedOps),
        loadHrs: r1(loadHrs),
        capacityHrsPerDay,
        backlogDays: r1(backlogDays),
        overloaded: backlogDays > 3, // > ~3 days backlog = bottleneck signal
      };
    });
  }

  /** SM-233: per open work order, earliest finish (load ÷ 8h/day) vs promised date → on-time/late. */
  async schedule(plantId: string) {
    const rows = (await this.db.query(
      `SELECT wo.number, p.part_no AS "partNo", wo.status, sl.promised_date AS "promisedDate",
              COALESCE(SUM(COALESCE(ro.setup_minutes,0) + COALESCE(ro.run_seconds_per_unit,0) * GREATEST(wo.qty - wo.qty_completed,0)/60.0), 0) AS "totalMinutes"
         FROM work_order wo
         JOIN part p ON p.id = wo.part_id
         JOIN so_line sl ON sl.id = wo.so_line_id
         LEFT JOIN wo_operation wop ON wop.work_order_id = wo.id AND wop.status <> 'completed'
         LEFT JOIN routing_op ro ON ro.id = wop.routing_op_id
        WHERE wo.plant_id = $1 AND wo.status IN ('planned','released','in_progress')
        GROUP BY wo.id, p.part_no, sl.promised_date
        ORDER BY sl.promised_date NULLS LAST, wo.number`,
      [plantId],
    )) as Array<{ number: string; partNo: string; status: string; promisedDate: string | null; totalMinutes: string }>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.map((r) => {
      const totalHrs = Number(r.totalMinutes) / 60;
      const days = Math.max(1, Math.ceil(totalHrs / 8));
      const plannedFinish = addDays(today, days);
      const promised = r.promisedDate ? new Date(r.promisedDate) : null;
      const late = promised ? plannedFinish > promised : false;
      return {
        number: r.number,
        partNo: r.partNo,
        status: r.status,
        promisedDate: r.promisedDate,
        totalHrs: r1(totalHrs),
        plannedFinish: plannedFinish.toISOString().slice(0, 10),
        late,
      };
    });
  }
}
