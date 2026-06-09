import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Inquiry } from './inquiry.entity';

/** Maps onto the `inquiry_line` table — one row per requested part. */
@Entity({ name: 'inquiry_line' })
export class InquiryLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inquiry_id', type: 'uuid' })
  inquiryId: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo: number;

  @Column({ name: 'part_name', type: 'text' })
  partName: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  qty: number;

  @Column({ name: 'material_grade_id', type: 'uuid', nullable: true })
  materialGradeId?: string;

  @Column({ name: 'thickness_mm', type: 'numeric', precision: 6, scale: 2, nullable: true })
  thicknessMm?: number;

  @Column({ name: 'finish_id', type: 'uuid', nullable: true })
  finishId?: string;

  @Column({ name: 'target_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  targetPrice?: number;

  @ManyToOne(() => Inquiry, (inquiry) => inquiry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inquiry_id' })
  inquiry: Inquiry;
}
