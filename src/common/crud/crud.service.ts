import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DeepPartial,
  FindOptionsOrder,
  FindOptionsWhere,
  ILike,
  ObjectLiteral,
  Repository,
} from 'typeorm';

/**
 * Configuration for the generic CrudService.
 *  - scopeField: tenancy column to filter/stamp ('orgId' for org masters,
 *    'plantId' for plant masters); omit for global lookups (uom, tax_code).
 *  - uniqueField: a column unique within scope (e.g. 'code') — conflict-checked
 *    on create so we return 409 instead of a raw DB constraint error.
 *  - audit: stamp created_by/updated_by (entities extending BaseEntity).
 *  - softDelete: use softRemove (entities with a DeleteDateColumn).
 */
export interface CrudConfig {
  scopeField?: 'orgId' | 'plantId';
  uniqueField?: string;
  label?: string;
  searchFields?: string[];
  orderBy?: Record<string, 'ASC' | 'DESC'>;
  audit?: boolean;
  softDelete?: boolean;
  take?: number;
}

/**
 * Reusable org/plant/global-scoped CRUD on top of a TypeORM repository.
 * Concrete services extend this and pass a CrudConfig; controllers stay thin.
 * Mirrors the original customers/ vertical slice, generalised.
 */
export class CrudService<T extends ObjectLiteral> {
  constructor(
    protected readonly repo: Repository<T>,
    protected readonly cfg: CrudConfig = {},
  ) {}

  protected scopeWhere(scopeId?: string): FindOptionsWhere<T> {
    return (this.cfg.scopeField && scopeId
      ? { [this.cfg.scopeField]: scopeId }
      : {}) as FindOptionsWhere<T>;
  }

  protected get label(): string {
    return this.cfg.label ?? this.repo.metadata.name;
  }

  async list(scopeId?: string, search?: string): Promise<T[]> {
    const base = this.scopeWhere(scopeId);
    const where: FindOptionsWhere<T> | FindOptionsWhere<T>[] =
      search && this.cfg.searchFields?.length
        ? this.cfg.searchFields.map(
            (f) => ({ ...base, [f]: ILike(`%${search}%`) }) as FindOptionsWhere<T>,
          )
        : base;
    return this.repo.find({
      where,
      order: (this.cfg.orderBy ?? {}) as FindOptionsOrder<T>,
      take: this.cfg.take ?? 200,
    });
  }

  async get(scopeId: string | undefined, id: string): Promise<T> {
    const entity = await this.repo.findOne({
      where: { ...this.scopeWhere(scopeId), id } as FindOptionsWhere<T>,
    });
    if (!entity) throw new NotFoundException(`${this.label} not found`);
    return entity;
  }

  async create(
    scopeId: string | undefined,
    userId: string,
    dto: DeepPartial<T>,
  ): Promise<T> {
    await this.assertUnique(scopeId, dto);
    const entity = this.repo.create({
      ...dto,
      ...(this.cfg.scopeField && scopeId ? { [this.cfg.scopeField]: scopeId } : {}),
      ...(this.cfg.audit ? { createdBy: userId, updatedBy: userId } : {}),
    } as DeepPartial<T>);
    return this.repo.save(entity);
  }

  async update(
    scopeId: string | undefined,
    userId: string,
    id: string,
    dto: DeepPartial<T>,
  ): Promise<T> {
    const entity = await this.get(scopeId, id);
    Object.assign(entity, dto, this.cfg.audit ? { updatedBy: userId } : {});
    return this.repo.save(entity);
  }

  async remove(
    scopeId: string | undefined,
    id: string,
  ): Promise<{ id: string; deleted: boolean }> {
    const entity = await this.get(scopeId, id);
    if (this.cfg.softDelete) await this.repo.softRemove(entity);
    else await this.repo.remove(entity);
    return { id, deleted: true };
  }

  private async assertUnique(
    scopeId: string | undefined,
    dto: DeepPartial<T>,
  ): Promise<void> {
    const field = this.cfg.uniqueField;
    const value = field ? (dto as Record<string, unknown>)[field] : undefined;
    if (!field || value == null) return;
    const existing = await this.repo.findOne({
      where: { ...this.scopeWhere(scopeId), [field]: value } as FindOptionsWhere<T>,
    });
    if (existing) {
      throw new ConflictException(`${this.label} ${field} '${String(value)}' already exists`);
    }
  }
}
