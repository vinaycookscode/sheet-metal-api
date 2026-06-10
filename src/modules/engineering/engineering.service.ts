import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Part } from './part.entity';
import { RoutingOp } from './routing-op.entity';
import { BomLine } from './bom-line.entity';
import { DocumentsService } from '../documents/documents.service';
import {
  BomLineDto,
  CreatePartDto,
  NewRevisionDto,
  ReleasePartDto,
  RoutingOpDto,
  UpdatePartDto,
} from './dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

const round4 = (n: number) => Math.round((n + Number.EPSILON) * 1e4) / 1e4;

export interface ExplodeNode {
  type: 'item' | 'part';
  itemId?: string;
  partId?: string;
  ref?: string;
  qtyRequired: number;
  scrapPct: number;
  components?: ExplodeNode[];
}

@Injectable()
export class EngineeringService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly documents: DocumentsService,
  ) {}

  async create(s: Scope, dto: CreatePartDto): Promise<Part> {
    const id = await this.db.transaction(async (em) => {
      const rev = dto.rev ?? 'A';
      await this.assertUnique(em, s.orgId, dto.partNo, rev);
      const part = em.create(Part, {
        orgId: s.orgId,
        partNo: dto.partNo,
        rev,
        description: dto.description,
        materialGradeId: dto.materialGradeId,
        thicknessMm: dto.thicknessMm,
        finishId: dto.finishId,
        flatLengthMm: dto.flatLengthMm,
        flatWidthMm: dto.flatWidthMm,
        bendCount: dto.bendCount ?? 0,
        isReleased: false,
        createdBy: s.userId,
        updatedBy: s.userId,
      });
      await em.save(part);
      if (dto.routing?.length) await em.save(this.buildRouting(em, part.id, dto.routing));
      if (dto.bom?.length) await em.save(this.buildBom(em, part.id, dto.bom));
      return part.id;
    });
    return this.findOne(s.orgId, id);
  }

  list(orgId: string, filter: { search?: string; released?: string }): Promise<Part[]> {
    const qb = this.db.getRepository(Part).createQueryBuilder('p').where('p.org_id = :orgId', { orgId });
    if (filter.search) {
      qb.andWhere('(p.part_no ILIKE :s OR p.description ILIKE :s)', { s: `%${filter.search}%` });
    }
    if (filter.released === 'true' || filter.released === 'false') {
      qb.andWhere('p.is_released = :r', { r: filter.released === 'true' });
    }
    return qb.orderBy('p.part_no', 'ASC').addOrderBy('p.rev', 'ASC').take(200).getMany();
  }

  async findOne(orgId: string, id: string): Promise<Part> {
    const part = await this.db.getRepository(Part).findOne({
      where: { id, orgId },
      relations: { routingOps: true, bomLines: true },
      order: { routingOps: { opNo: 'ASC' } },
    });
    if (!part) throw new NotFoundException('Part not found');
    return part;
  }

  async updateHeader(s: Scope, id: string, dto: UpdatePartDto): Promise<Part> {
    const part = await this.findOne(s.orgId, id);
    this.assertEditable(part);
    Object.assign(part, dto, { updatedBy: s.userId });
    await this.db.getRepository(Part).save(part);
    return this.findOne(s.orgId, id);
  }

  async replaceRouting(s: Scope, id: string, ops: RoutingOpDto[]): Promise<Part> {
    await this.db.transaction(async (em) => {
      const part = await this.loadEditable(em, s.orgId, id);
      await em.delete(RoutingOp, { partId: part.id });
      if (ops.length) await em.save(this.buildRouting(em, part.id, ops));
      await em.update(Part, { id: part.id }, { updatedBy: s.userId });
    });
    return this.findOne(s.orgId, id);
  }

  async replaceBom(s: Scope, id: string, lines: BomLineDto[]): Promise<Part> {
    await this.db.transaction(async (em) => {
      const part = await this.loadEditable(em, s.orgId, id);
      await em.delete(BomLine, { partId: part.id });
      if (lines.length) await em.save(this.buildBom(em, part.id, lines, part.id));
      await em.update(Part, { id: part.id }, { updatedBy: s.userId });
    });
    return this.findOne(s.orgId, id);
  }

  async newRevision(s: Scope, id: string, dto: NewRevisionDto): Promise<Part> {
    const newId = await this.db.transaction(async (em) => {
      const src = await em.getRepository(Part).findOne({
        where: { id, orgId: s.orgId },
        relations: { routingOps: true, bomLines: true },
      });
      if (!src) throw new NotFoundException('Part not found');
      const rev = dto.rev ?? nextRev(src.rev);
      await this.assertUnique(em, s.orgId, src.partNo, rev);

      const part = em.create(Part, {
        orgId: s.orgId,
        partNo: src.partNo,
        rev,
        description: src.description,
        materialGradeId: src.materialGradeId,
        thicknessMm: src.thicknessMm,
        finishId: src.finishId,
        flatLengthMm: src.flatLengthMm,
        flatWidthMm: src.flatWidthMm,
        bendCount: src.bendCount,
        isReleased: false,
        createdBy: s.userId,
        updatedBy: s.userId,
      });
      await em.save(part);
      await em.save(
        src.routingOps.map((o) =>
          em.create(RoutingOp, {
            partId: part.id,
            opNo: o.opNo,
            operationId: o.operationId,
            workCenterId: o.workCenterId,
            setupMinutes: o.setupMinutes,
            runSecondsPerUnit: o.runSecondsPerUnit,
            isOutside: o.isOutside,
            instructions: o.instructions,
          }),
        ),
      );
      await em.save(
        src.bomLines.map((b) =>
          em.create(BomLine, {
            partId: part.id,
            componentItemId: b.componentItemId,
            componentPartId: b.componentPartId,
            qtyPer: b.qtyPer,
            scrapPct: b.scrapPct,
          }),
        ),
      );
      return part.id;
    });
    return this.findOne(s.orgId, newId);
  }

  /** Engineering release (SM-133): lock the part; optionally release an SO line to plan. */
  async release(s: Scope, id: string, dto: ReleasePartDto): Promise<Part> {
    // Drawing-review gate (SM-211): if drawings are attached, at least one must be approved.
    const draw = await this.documents.drawingStatus(s.orgId, 'part', id);
    if (draw.total > 0 && draw.approved === 0) {
      throw new BadRequestException('Release blocked: the part has drawings but none are approved. Approve a drawing first.');
    }
    await this.db.transaction(async (em) => {
      const part = await em.getRepository(Part).findOne({ where: { id, orgId: s.orgId } });
      if (!part) throw new NotFoundException('Part not found');

      const routingCount = await em.getRepository(RoutingOp).count({ where: { partId: id } });
      if (routingCount === 0) {
        throw new BadRequestException('Cannot release a part with no routing operations');
      }

      part.isReleased = true;
      part.updatedBy = s.userId;
      await em.save(part);

      if (dto.soLineId) {
        const rows = (await em.query(
          `SELECT sl.id, sl.status
             FROM so_line sl JOIN sales_order so ON so.id = sl.sales_order_id
            WHERE sl.id = $1 AND so.plant_id = $2`,
          [dto.soLineId, s.plantId],
        )) as Array<{ id: string; status: string }>;
        if (!rows[0]) throw new NotFoundException('SO line not found');
        if (rows[0].status !== 'open') {
          throw new BadRequestException(`SO line is '${rows[0].status}', expected 'open'`);
        }
        await em.query(
          `UPDATE so_line SET part_id = $1, status = 'released_to_plan' WHERE id = $2`,
          [id, dto.soLineId],
        );
      }
    });
    return this.findOne(s.orgId, id);
  }

  /** Recursive, cycle-safe multi-level BOM explosion (SM-132). */
  async explode(orgId: string, id: string, qty: number): Promise<{ partId: string; ref: string; qty: number; components: ExplodeNode[] }> {
    const root = await this.findOne(orgId, id);
    const components = await this.explodeNode(orgId, id, qty, new Set([id]));
    return { partId: id, ref: `${root.partNo}-${root.rev}`, qty, components };
  }

  /** Flatten the BOM explosion to summed leaf-item (raw/hardware/consumable) requirements. */
  async explodeItems(orgId: string, partId: string, qty: number): Promise<Array<{ itemId: string; qtyRequired: number }>> {
    const tree = await this.explode(orgId, partId, qty);
    const totals = new Map<string, number>();
    const walk = (nodes: ExplodeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'item' && n.itemId) {
          totals.set(n.itemId, round4((totals.get(n.itemId) ?? 0) + n.qtyRequired));
        } else if (n.components) {
          walk(n.components);
        }
      }
    };
    walk(tree.components);
    return [...totals].map(([itemId, qtyRequired]) => ({ itemId, qtyRequired }));
  }

  private async explodeNode(orgId: string, partId: string, multiplier: number, ancestors: Set<string>): Promise<ExplodeNode[]> {
    const lines = await this.db.getRepository(BomLine).find({ where: { partId } });
    const out: ExplodeNode[] = [];
    for (const l of lines) {
      const eff = round4(multiplier * Number(l.qtyPer) * (1 + Number(l.scrapPct) / 100));
      if (l.componentItemId) {
        const it = (await this.db.query(`SELECT code, name FROM item WHERE id = $1`, [l.componentItemId])) as Array<{ code: string; name: string }>;
        out.push({ type: 'item', itemId: l.componentItemId, ref: it[0]?.code, qtyRequired: eff, scrapPct: Number(l.scrapPct) });
      } else if (l.componentPartId) {
        if (ancestors.has(l.componentPartId)) {
          throw new BadRequestException(`BOM cycle detected — part ${l.componentPartId} references an ancestor`);
        }
        const p = (await this.db.query(`SELECT part_no, rev FROM part WHERE id = $1`, [l.componentPartId])) as Array<{ part_no: string; rev: string }>;
        out.push({
          type: 'part',
          partId: l.componentPartId,
          ref: p[0] ? `${p[0].part_no}-${p[0].rev}` : undefined,
          qtyRequired: eff,
          scrapPct: Number(l.scrapPct),
          components: await this.explodeNode(orgId, l.componentPartId, eff, new Set([...ancestors, l.componentPartId])),
        });
      }
    }
    return out;
  }

  // --- helpers -----------------------------------------------------------
  private async assertUnique(em: EntityManager, orgId: string, partNo: string, rev: string): Promise<void> {
    const existing = await em.getRepository(Part).findOne({ where: { orgId, partNo, rev } });
    if (existing) throw new ConflictException(`Part ${partNo} rev ${rev} already exists`);
  }

  private async loadEditable(em: EntityManager, orgId: string, id: string): Promise<Part> {
    const part = await em.getRepository(Part).findOne({ where: { id, orgId } });
    if (!part) throw new NotFoundException('Part not found');
    this.assertEditable(part);
    return part;
  }

  private assertEditable(part: Part): void {
    if (part.isReleased) {
      throw new BadRequestException(
        `Part ${part.partNo} rev ${part.rev} is released and locked — create a new revision to change it`,
      );
    }
  }

  private buildRouting(em: EntityManager, partId: string, ops: RoutingOpDto[]): RoutingOp[] {
    return ops.map((op, i) => em.create(RoutingOp, { ...op, partId, opNo: i + 1 }));
  }

  private buildBom(em: EntityManager, partId: string, lines: BomLineDto[], selfId?: string): BomLine[] {
    return lines.map((l) => {
      const refs = (l.componentItemId ? 1 : 0) + (l.componentPartId ? 1 : 0);
      if (refs !== 1) {
        throw new BadRequestException('Each BOM line needs exactly one of componentItemId or componentPartId');
      }
      if (selfId && l.componentPartId === selfId) {
        throw new BadRequestException('A part cannot be a component of itself');
      }
      return em.create(BomLine, { ...l, partId, scrapPct: l.scrapPct ?? 0 });
    });
  }
}

/** A->B, Z->Z1, numeric->+1 */
function nextRev(rev: string): string {
  if (/^[A-Y]$/.test(rev)) return String.fromCharCode(rev.charCodeAt(0) + 1);
  const n = parseInt(rev, 10);
  if (!Number.isNaN(n) && String(n) === rev) return String(n + 1);
  return `${rev}1`;
}
