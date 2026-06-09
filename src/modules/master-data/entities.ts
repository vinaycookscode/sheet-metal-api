import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { RATE_BASES, RateBasis } from '../../common/enums';

/**
 * Master-data lookup tables (SCHEMA.sql §3). These are minimal reference
 * tables — no audit/soft-delete columns — so they map directly rather than
 * extending BaseEntity. Scope: uom/tax_code are global; material_grade,
 * finish, operation are org-scoped; work_center is plant-scoped.
 */

@Entity({ name: 'uom' })
export class Uom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Column({ type: 'text' })
  name: string;
}

@Entity({ name: 'tax_code' })
export class TaxCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hsn_sac', type: 'varchar', length: 8 })
  hsnSac: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'gst_rate', type: 'numeric', precision: 5, scale: 2 })
  gstRate: number;
}

@Entity({ name: 'material_grade' })
export class MaterialGrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'numeric', precision: 8, scale: 4, nullable: true })
  density?: number;

  @Column({ name: 'default_rate', type: 'numeric', precision: 12, scale: 4, nullable: true })
  defaultRate?: number;

  @Column({ name: 'is_traceable', type: 'boolean', default: false })
  isTraceable: boolean;
}

@Entity({ name: 'finish_master' })
export class Finish {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'is_outside', type: 'boolean', default: false })
  isOutside: boolean;
}

@Entity({ name: 'work_center' })
export class WorkCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'capacity_hrs_per_day', type: 'numeric', precision: 6, scale: 2, default: 8 })
  capacityHrsPerDay: number;

  @Column({ name: 'hourly_rate', type: 'numeric', precision: 12, scale: 4, nullable: true })
  hourlyRate?: number;

  @Column({ name: 'is_outside', type: 'boolean', default: false })
  isOutside: boolean;
}

@Entity({ name: 'operation_master' })
export class Operation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'default_work_center_id', type: 'uuid', nullable: true })
  defaultWorkCenterId?: string;

  @Column({ name: 'rate_basis', type: 'varchar', length: 16 })
  rateBasis: RateBasis;

  @Column({ name: 'default_rate', type: 'numeric', precision: 12, scale: 4, nullable: true })
  defaultRate?: number;
}

export const MASTER_DATA_ENTITIES = [
  Uom,
  TaxCode,
  MaterialGrade,
  Finish,
  WorkCenter,
  Operation,
];

export { RATE_BASES };
