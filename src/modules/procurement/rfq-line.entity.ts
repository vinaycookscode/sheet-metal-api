import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'rfq_line' })
export class RfqLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rfq_id', type: 'uuid' })
  rfqId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ type: 'numeric', precision: 14, scale: 3 })
  qty: number;
}
