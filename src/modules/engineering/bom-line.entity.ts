import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Part } from './part.entity';

/**
 * Maps onto the `bom_line` table. A component is either a raw item
 * (component_item_id) or a sub-assembly part (component_part_id, recursive).
 */
@Entity({ name: 'bom_line' })
export class BomLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'part_id', type: 'uuid' })
  partId: string;

  @Column({ name: 'component_item_id', type: 'uuid', nullable: true })
  componentItemId?: string;

  @Column({ name: 'component_part_id', type: 'uuid', nullable: true })
  componentPartId?: string;

  @Column({ name: 'qty_per', type: 'numeric', precision: 12, scale: 4 })
  qtyPer: number;

  @Column({ name: 'scrap_pct', type: 'numeric', precision: 6, scale: 2, default: 0 })
  scrapPct: number;

  @ManyToOne(() => Part, (part) => part.bomLines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'part_id' })
  part: Part;
}
