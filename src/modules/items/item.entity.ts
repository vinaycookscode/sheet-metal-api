import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ITEM_TYPES, ItemType } from '../../common/enums';

/** Maps onto the `item` table in SCHEMA.sql (raw sheet / hardware / consumable / FG). */
@Entity({ name: 'item' })
export class Item extends BaseEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'item_type', type: 'enum', enum: ITEM_TYPES, enumName: 'item_type' })
  itemType: ItemType;

  @Column({ name: 'uom_id', type: 'uuid' })
  uomId: string;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId?: string;

  @Column({ name: 'material_grade_id', type: 'uuid', nullable: true })
  materialGradeId?: string;

  @Column({ name: 'thickness_mm', type: 'numeric', precision: 6, scale: 2, nullable: true })
  thicknessMm?: number;

  @Column({ name: 'sheet_length_mm', type: 'numeric', precision: 8, scale: 2, nullable: true })
  sheetLengthMm?: number;

  @Column({ name: 'sheet_width_mm', type: 'numeric', precision: 8, scale: 2, nullable: true })
  sheetWidthMm?: number;

  @Column({ name: 'is_traceable', type: 'boolean', default: false })
  isTraceable: boolean;

  @Column({ name: 'std_cost', type: 'numeric', precision: 12, scale: 4, nullable: true })
  stdCost?: number;
}
