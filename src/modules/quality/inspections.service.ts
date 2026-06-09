import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Inspection } from './inspection.entity';
import { InspectionChar } from './inspection-char.entity';
import { InspectionResult } from '../../common/enums';
import { CreateInspectionDto, RecordInspectionDto } from './dto';

interface Scope {
  plantId: string;
  userId: string;
}

@Injectable()
export class InspectionsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async create(s: Scope, dto: CreateInspectionDto): Promise<Inspection> {
    const id = await this.db.transaction(async (em) => {
      const insp = em.create(Inspection, {
        plantId: s.plantId,
        kind: dto.kind,
        result: 'pending',
        workOrderId: dto.workOrderId,
        soLineId: dto.soLineId,
        grnLineId: dto.grnLineId,
        notes: dto.notes,
      });
      await em.save(insp);
      await em.save(dto.characteristics.map((c) => em.create(InspectionChar, { ...c, inspectionId: insp.id, result: 'pending' })));
      return insp.id;
    });
    return this.findOne(s.plantId, id);
  }

  /** Record measured values, evaluate each characteristic and roll up the result (SM-160). */
  async record(s: Scope, id: string, dto: RecordInspectionDto): Promise<Inspection> {
    await this.db.transaction(async (em) => {
      const insp = await em.getRepository(Inspection).findOne({ where: { id, plantId: s.plantId }, relations: { characteristics: true } });
      if (!insp) throw new NotFoundException('Inspection not found');

      const byId = new Map(insp.characteristics.map((c) => [c.id, c]));
      for (const r of dto.results) {
        const char = byId.get(r.charId);
        if (!char) throw new BadRequestException(`Characteristic ${r.charId} is not on this inspection`);
        char.measured = r.measured;
        char.result = this.evaluate(char, r.result);
      }
      await em.save([...byId.values()]);

      const results = [...byId.values()].map((c) => c.result);
      insp.result = results.includes('fail') ? 'fail' : results.every((x) => x === 'pass') ? 'pass' : 'pending';
      insp.inspectorId = s.userId;
      insp.inspectedAt = new Date();
      await em.save(insp);
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { kind?: string; result?: string; soLineId?: string; workOrderId?: string }): Promise<Inspection[]> {
    const where: Record<string, unknown> = { plantId };
    for (const k of ['kind', 'result', 'soLineId', 'workOrderId'] as const) if (filter[k]) where[k] = filter[k];
    return this.db.getRepository(Inspection).find({ where, take: 200 });
  }

  async findOne(plantId: string, id: string): Promise<Inspection> {
    const insp = await this.db.getRepository(Inspection).findOne({ where: { id, plantId }, relations: { characteristics: true } });
    if (!insp) throw new NotFoundException('Inspection not found');
    return insp;
  }

  /** Dimensional chars pass within nominal ± tolerance; attribute chars use the given result. */
  private evaluate(char: InspectionChar, given?: 'pass' | 'fail'): InspectionResult {
    if (char.nominal != null) {
      if (char.measured == null) return 'pending';
      const lo = Number(char.nominal) - Number(char.toleranceMinus ?? 0);
      const hi = Number(char.nominal) + Number(char.tolerancePlus ?? 0);
      return Number(char.measured) >= lo && Number(char.measured) <= hi ? 'pass' : 'fail';
    }
    return given ?? 'pending';
  }
}
