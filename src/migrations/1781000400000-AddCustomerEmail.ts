import { MigrationInterface, QueryRunner } from 'typeorm';

/** Capture a contact email on the customer so quotes/invoices can be emailed. */
export class AddCustomerEmail1781000400000 implements MigrationInterface {
  name = 'AddCustomerEmail1781000400000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE customer ADD COLUMN IF NOT EXISTS email text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE customer DROP COLUMN IF EXISTS email`);
  }
}
