import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quote response / negotiation tracking: a 'negotiating' status, a public response
 * token + next-follow-up date on the quote, and a quote_followup timeline table.
 */
export class AddQuoteResponse1781000500000 implements MigrationInterface {
  name = 'AddQuoteResponse1781000500000';

  public async up(q: QueryRunner): Promise<void> {
    // New enum value (safe in a txn as long as it isn't used in the same txn).
    await q.query(`ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'negotiating' AFTER 'sent'`);

    await q.query(`ALTER TABLE quote ADD COLUMN IF NOT EXISTS response_token varchar(64)`);
    await q.query(`ALTER TABLE quote ADD COLUMN IF NOT EXISTS next_follow_up_date date`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_quote_response_token ON quote(response_token)`);

    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_followup_kind') THEN
          CREATE TYPE quote_followup_kind AS ENUM ('sent', 'accepted', 'rejected', 'negotiating', 'follow_up', 'note', 'revised');
        END IF;
      END $$;`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS quote_followup (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id         uuid NOT NULL REFERENCES quote(id),
        quote_version_id uuid,
        kind             quote_followup_kind NOT NULL,
        source           varchar(12) NOT NULL DEFAULT 'internal',
        note             text,
        reject_reason    varchar(24),
        counter_amount   numeric(14,2),
        created_by       uuid,
        created_at       timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_quote_followup_quote ON quote_followup(quote_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS quote_followup`);
    await q.query(`DROP TYPE IF EXISTS quote_followup_kind`);
    await q.query(`DROP INDEX IF EXISTS idx_quote_response_token`);
    await q.query(`ALTER TABLE quote DROP COLUMN IF EXISTS next_follow_up_date`);
    await q.query(`ALTER TABLE quote DROP COLUMN IF EXISTS response_token`);
    // Note: Postgres can't easily drop an enum value; 'negotiating' is left in place on down.
  }
}
