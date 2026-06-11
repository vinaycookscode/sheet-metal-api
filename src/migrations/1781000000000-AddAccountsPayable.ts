import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountsPayable1781000000000 implements MigrationInterface {
  name = 'AddAccountsPayable1781000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE supplier_invoice (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id            uuid NOT NULL REFERENCES org(id),
        plant_id          uuid NOT NULL REFERENCES plant(id),
        supplier_id       uuid NOT NULL REFERENCES supplier(id),
        purchase_order_id uuid REFERENCES purchase_order(id),
        supplier_ref      text,
        invoice_date      date NOT NULL DEFAULT current_date,
        subtotal          numeric(14,2) NOT NULL DEFAULT 0,
        tax_total         numeric(14,2) NOT NULL DEFAULT 0,
        grand_total       numeric(14,2) NOT NULL DEFAULT 0,
        amount_paid       numeric(14,2) NOT NULL DEFAULT 0,
        match_status      varchar(12) NOT NULL DEFAULT 'unmatched',
        status            varchar(16) NOT NULL DEFAULT 'draft',
        created_at        timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX idx_supplier_invoice_plant ON supplier_invoice (plant_id, status)`);
    await q.query(`
      CREATE TABLE vendor_payment (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id              uuid NOT NULL REFERENCES org(id),
        plant_id            uuid NOT NULL REFERENCES plant(id),
        supplier_id         uuid NOT NULL REFERENCES supplier(id),
        supplier_invoice_id uuid REFERENCES supplier_invoice(id),
        amount              numeric(14,2) NOT NULL,
        method              varchar(24),
        reference           text,
        paid_at             timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS vendor_payment`);
    await q.query(`DROP TABLE IF EXISTS supplier_invoice`);
  }
}
