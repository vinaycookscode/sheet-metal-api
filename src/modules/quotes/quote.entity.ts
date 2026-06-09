import { Column, Entity, OneToMany } from 'typeorm';
import { AuditedEntity } from '../../common/entities/audited.entity';
import { QUOTE_STATUSES, QuoteStatus } from '../../common/enums';
import { QuoteVersion } from './quote-version.entity';

/** Maps onto the `quote` table. Pricing lives in versioned children (quote_version). */
@Entity({ name: 'quote' })
export class Quote extends AuditedEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ name: 'inquiry_id', type: 'uuid', nullable: true })
  inquiryId?: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion: number;

  @Column({ type: 'enum', enum: QUOTE_STATUSES, enumName: 'quote_status', default: 'draft' })
  status: QuoteStatus;

  @Column({ name: 'win_loss_reason', type: 'varchar', length: 40, nullable: true })
  winLossReason?: string;

  @OneToMany(() => QuoteVersion, (v) => v.quote, { cascade: true })
  versions: QuoteVersion[];
}
