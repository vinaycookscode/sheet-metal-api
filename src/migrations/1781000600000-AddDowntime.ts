import { MigrationInterface, QueryRunner } from 'typeorm';

/** Shop-floor downtime capture (Production Intelligence): downtime_event + reason enum. */
export class AddDowntime1781000600000 implements MigrationInterface {
  name = 'AddDowntime1781000600000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'downtime_reason') THEN
          CREATE TYPE downtime_reason AS ENUM (
            'setup', 'changeover', 'breakdown', 'maintenance', 'no_material',
            'no_operator', 'tooling', 'quality_hold', 'power', 'other'
          );
        END IF;
      END $$;`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS downtime_event (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id           uuid NOT NULL,
        plant_id         uuid NOT NULL,
        work_center_id   uuid NOT NULL REFERENCES work_center(id),
        wo_operation_id  uuid,
        reason           downtime_reason NOT NULL,
        notes            text,
        started_at       timestamptz NOT NULL DEFAULT now(),
        ended_at         timestamptz,
        logged_by        uuid,
        created_at       timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_downtime_wc ON downtime_event(work_center_id)`);
    // Fast lookup of the open downtime per work center.
    await q.query(`CREATE INDEX IF NOT EXISTS idx_downtime_open ON downtime_event(plant_id) WHERE ended_at IS NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS downtime_event`);
    await q.query(`DROP TYPE IF EXISTS downtime_reason`);
  }
}
