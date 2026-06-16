import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer → Project hierarchy. Creates the project table, adds a (nullable)
 * project_id to inquiry/quote/sales_order/work_order, and backfills a per-customer
 * "General" project so existing records are never orphaned. project_id stays nullable
 * in the DB (required only at the inquiry DTO level) to keep backfill + edge cases safe.
 */
export class AddProjects1781000300000 implements MigrationInterface {
  name = 'AddProjects1781000300000';

  public async up(q: QueryRunner): Promise<void> {
    // 1. enum + table
    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
          CREATE TYPE project_status AS ENUM ('active', 'on_hold', 'completed', 'cancelled');
        END IF;
      END $$;`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS project (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id      uuid NOT NULL,
        plant_id    uuid NOT NULL,
        customer_id uuid NOT NULL REFERENCES customer(id),
        code        varchar(24) NOT NULL,
        name        text NOT NULL,
        status      project_status NOT NULL DEFAULT 'active',
        description text,
        target_date date,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        created_by  uuid,
        updated_by  uuid,
        deleted_at  timestamptz,
        UNIQUE (org_id, code)
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_project_customer ON project(customer_id)`);

    // 2. add nullable project_id to the document headers
    for (const t of ['inquiry', 'quote', 'sales_order', 'work_order']) {
      await q.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS project_id uuid`);
    }

    // 3. backfill: one "General" project per customer that has any commercial document
    await q.query(`
      INSERT INTO project (org_id, plant_id, customer_id, code, name)
      SELECT c.org_id,
             COALESCE(
               (SELECT i.plant_id  FROM inquiry i      WHERE i.customer_id  = c.id ORDER BY i.created_at  LIMIT 1),
               (SELECT qt.plant_id FROM quote qt       WHERE qt.customer_id = c.id ORDER BY qt.created_at LIMIT 1),
               (SELECT so.plant_id FROM sales_order so WHERE so.customer_id = c.id ORDER BY so.created_at LIMIT 1)
             ),
             c.id,
             'PRJ-GEN-' || substr(replace(c.id::text, '-', ''), 1, 8),
             'General'
        FROM customer c
       WHERE EXISTS (SELECT 1 FROM inquiry i      WHERE i.customer_id  = c.id)
          OR EXISTS (SELECT 1 FROM quote qt       WHERE qt.customer_id = c.id)
          OR EXISTS (SELECT 1 FROM sales_order so WHERE so.customer_id = c.id)`);

    await q.query(`UPDATE inquiry      SET project_id = p.id FROM project p WHERE p.customer_id = inquiry.customer_id      AND p.name = 'General' AND inquiry.project_id      IS NULL`);
    await q.query(`UPDATE quote        SET project_id = p.id FROM project p WHERE p.customer_id = quote.customer_id        AND p.name = 'General' AND quote.project_id        IS NULL`);
    await q.query(`UPDATE sales_order  SET project_id = p.id FROM project p WHERE p.customer_id = sales_order.customer_id  AND p.name = 'General' AND sales_order.project_id  IS NULL`);
    await q.query(`
      UPDATE work_order SET project_id = so.project_id
        FROM so_line sl JOIN sales_order so ON so.id = sl.sales_order_id
       WHERE sl.id = work_order.so_line_id AND work_order.project_id IS NULL`);

    // 4. FK + index per header
    for (const t of ['inquiry', 'quote', 'sales_order', 'work_order']) {
      await q.query(`ALTER TABLE ${t} ADD CONSTRAINT fk_${t}_project FOREIGN KEY (project_id) REFERENCES project(id)`);
      await q.query(`CREATE INDEX IF NOT EXISTS idx_${t}_project ON ${t}(project_id)`);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['inquiry', 'quote', 'sales_order', 'work_order']) {
      await q.query(`DROP INDEX IF EXISTS idx_${t}_project`);
      await q.query(`ALTER TABLE ${t} DROP CONSTRAINT IF EXISTS fk_${t}_project`);
      await q.query(`ALTER TABLE ${t} DROP COLUMN IF EXISTS project_id`);
    }
    await q.query(`DROP TABLE IF EXISTS project`);
    await q.query(`DROP TYPE IF EXISTS project_status`);
  }
}
