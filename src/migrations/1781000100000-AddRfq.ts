import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRfq1781000100000 implements MigrationInterface {
  name = 'AddRfq1781000100000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE rfq (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id     uuid NOT NULL REFERENCES org(id),
        plant_id   uuid NOT NULL REFERENCES plant(id),
        number     varchar(24) NOT NULL,
        status     varchar(16) NOT NULL DEFAULT 'open',
        notes      text,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (plant_id, number)
      )
    `);
    await q.query(`
      CREATE TABLE rfq_line (
        id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rfq_id  uuid NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES item(id),
        qty     numeric(14,3) NOT NULL
      )
    `);
    await q.query(`
      CREATE TABLE rfq_quote (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rfq_id      uuid NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
        rfq_line_id uuid NOT NULL REFERENCES rfq_line(id) ON DELETE CASCADE,
        supplier_id uuid NOT NULL REFERENCES supplier(id),
        unit_price  numeric(14,4) NOT NULL,
        lead_days   int,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX idx_rfq_line_rfq ON rfq_line (rfq_id)`);
    await q.query(`CREATE INDEX idx_rfq_quote_rfq ON rfq_quote (rfq_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS rfq_quote`);
    await q.query(`DROP TABLE IF EXISTS rfq_line`);
    await q.query(`DROP TABLE IF EXISTS rfq`);
  }
}
