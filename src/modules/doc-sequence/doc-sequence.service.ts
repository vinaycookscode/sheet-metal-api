import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequence } from './doc-sequence.entity';

/** Default prefix per doc type when a sequence is first auto-created. */
const DEFAULT_PREFIX: Record<string, string> = {
  INQ: 'INQ', QT: 'QT', SO: 'SO', WO: 'WO',
  PO: 'PO', GRN: 'GRN', INV: 'INV', DC: 'DC', NCR: 'NCR',
};

/**
 * Indian fiscal year (Apr–Mar) as 'YYYY-YY', e.g. 2026-06-08 -> '2026-27'.
 */
export function currentFiscalYear(d: Date = new Date()): string {
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

/**
 * Gapless, concurrency-safe document numbering (SM-010).
 * Allocation is a single atomic UPDATE ... RETURNING under a row lock, so two
 * concurrent callers can never get the same number. The sequence row is
 * auto-created on first use via INSERT ... ON CONFLICT DO NOTHING.
 */
@Injectable()
export class DocSequenceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Allocate (consume) the next number for a doc type, e.g. 'INQ-2026-27-00001'. */
  async allocate(plantId: string, docType: string, manager?: EntityManager): Promise<string> {
    const run = (em: EntityManager) => this.allocateWith(em, plantId, docType);
    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  private async allocateWith(em: EntityManager, plantId: string, docType: string): Promise<string> {
    const fy = currentFiscalYear();
    const prefix = DEFAULT_PREFIX[docType] ?? docType;

    await em.query(
      `INSERT INTO doc_sequence (plant_id, doc_type, fiscal_year, prefix, pad_width, next_value)
       VALUES ($1, $2, $3, $4, 5, 1)
       ON CONFLICT (plant_id, doc_type, fiscal_year) DO NOTHING`,
      [plantId, docType, fy, prefix],
    );

    const result = await em.query(
      `UPDATE doc_sequence
          SET next_value = next_value + 1
        WHERE plant_id = $1 AND doc_type = $2 AND fiscal_year = $3
        RETURNING prefix, (next_value - 1) AS allocated, pad_width`,
      [plantId, docType, fy],
    );

    // TypeORM returns [rows, affectedCount] for UPDATE ... RETURNING
    // (but plain rows for INSERT ... RETURNING) — normalise both shapes.
    const rows = Array.isArray(result[0]) ? result[0] : result;
    const r = rows[0];
    const padded = String(r.allocated).padStart(r.pad_width, '0');
    return `${r.prefix}-${fy}-${padded}`;
  }

  /** List the configured counters for a plant. */
  list(plantId: string): Promise<DocSequence[]> {
    return this.dataSource.getRepository(DocSequence).find({
      where: { plantId },
      order: { fiscalYear: 'DESC', docType: 'ASC' },
    });
  }
}
