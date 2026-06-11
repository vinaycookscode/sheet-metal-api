import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShipmentAcceptance1781000200000 implements MigrationInterface {
  name = 'AddShipmentAcceptance1781000200000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE shipment ADD COLUMN accepted_at timestamptz`);
    await q.query(`ALTER TABLE shipment ADD COLUMN accepted_by text`);
    await q.query(`ALTER TABLE shipment ADD COLUMN acceptance_note text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE shipment DROP COLUMN IF EXISTS acceptance_note`);
    await q.query(`ALTER TABLE shipment DROP COLUMN IF EXISTS accepted_by`);
    await q.query(`ALTER TABLE shipment DROP COLUMN IF EXISTS accepted_at`);
  }
}
