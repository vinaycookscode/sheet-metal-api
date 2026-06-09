import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { Ncr } from './ncr.entity';
import { CreateNcrDto, DispositionDto } from './dto';

interface Scope {
  plantId: string;
  userId: string;
}

@Injectable()
export class NcrService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
  ) {}

  async create(s: Scope, dto: CreateNcrDto): Promise<Ncr> {
    const id = await this.db.transaction(async (em) => {
      const number = await this.docSeq.allocate(s.plantId, 'NCR', em);
      const ncr = em.create(Ncr, {
        plantId: s.plantId,
        number,
        source: dto.source,
        workOrderId: dto.workOrderId,
        stockLotId: dto.stockLotId,
        supplierId: dto.supplierId,
        defect: dto.defect,
        isCritical: dto.isCritical ?? false,
        disposition: 'pending',
        status: 'open',
        costOfQuality: dto.costOfQuality,
      });
      await em.save(ncr);
      return ncr.id;
    });
    return this.findOne(s.plantId, id);
  }

  async disposition(s: Scope, id: string, dto: DispositionDto): Promise<Ncr> {
    const repo = this.db.getRepository(Ncr);
    const ncr = await repo.findOne({ where: { id, plantId: s.plantId } });
    if (!ncr) throw new NotFoundException('NCR not found');
    if (ncr.status !== 'open') throw new BadRequestException(`NCR is '${ncr.status}', expected 'open'`);
    ncr.disposition = dto.disposition;
    ncr.status = 'dispositioned';
    if (dto.costOfQuality != null) ncr.costOfQuality = dto.costOfQuality;
    await repo.save(ncr);
    return ncr;
  }

  async close(s: Scope, id: string): Promise<Ncr> {
    const repo = this.db.getRepository(Ncr);
    const ncr = await repo.findOne({ where: { id, plantId: s.plantId } });
    if (!ncr) throw new NotFoundException('NCR not found');
    if (ncr.status === 'closed') throw new BadRequestException('NCR already closed');
    if (ncr.disposition === 'pending') throw new BadRequestException('Disposition the NCR before closing');
    ncr.status = 'closed';
    ncr.closedAt = new Date();
    await repo.save(ncr);
    return ncr;
  }

  list(plantId: string, filter: { status?: string; critical?: string }): Promise<Ncr[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    if (filter.critical === 'true' || filter.critical === 'false') where.isCritical = filter.critical === 'true';
    return this.db.getRepository(Ncr).find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(plantId: string, id: string): Promise<Ncr> {
    const ncr = await this.db.getRepository(Ncr).findOne({ where: { id, plantId } });
    if (!ncr) throw new NotFoundException('NCR not found');
    return ncr;
  }
}
