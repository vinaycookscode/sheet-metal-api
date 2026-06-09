import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Grn } from './grn.entity';

/** Maps onto `grn_line`. */
@Entity({ name: 'grn_line' })
export class GrnLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'grn_id', type: 'uuid' })
  grnId: string;

  @Column({ name: 'po_line_id', type: 'uuid' })
  poLineId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'qty_received', type: 'numeric', precision: 12, scale: 3 })
  qtyReceived: number;

  @Column({ name: 'qty_rejected', type: 'numeric', precision: 12, scale: 3, default: 0 })
  qtyRejected: number;

  @Column({ name: 'heat_no', type: 'varchar', length: 40, nullable: true })
  heatNo?: string;

  @Column({ name: 'lot_no', type: 'varchar', length: 40, nullable: true })
  lotNo?: string;

  @Column({ name: 'cert_document_id', type: 'uuid', nullable: true })
  certDocumentId?: string;

  @ManyToOne(() => Grn, (grn) => grn.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grn_id' })
  grn: Grn;
}
