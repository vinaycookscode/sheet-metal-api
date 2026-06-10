import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { Inquiry } from './inquiry.entity';
import { InquiryLine } from './inquiry-line.entity';
import { InquiryStatus } from '../../common/enums';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryLineDto } from './dto/inquiry-line.dto';
import {
  InquiryOutcomeDto,
  SendToEstimationDto,
  UpdateInquiryDto,
} from './dto/update-inquiry.dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

@Injectable()
export class InquiriesService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
  ) {}

  async create(s: Scope, dto: CreateInquiryDto): Promise<Inquiry> {
    const id = await this.db.transaction(async (em) => {
      const number = await this.docSeq.allocate(s.plantId, 'INQ', em);
      const inquiry = em.create(Inquiry, {
        orgId: s.orgId,
        plantId: s.plantId,
        number,
        customerId: dto.customerId,
        status: 'new',
        requiredDate: dto.requiredDate,
        ownerId: dto.ownerId ?? s.userId,
        notes: dto.notes,
        createdBy: s.userId,
        updatedBy: s.userId,
      });
      await em.save(inquiry);
      await em.save(this.buildLines(em, inquiry.id, dto.lines));
      return inquiry.id;
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { status?: string; customerId?: string }): Promise<Inquiry[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    return this.db.getRepository(Inquiry).find({
      where,
      relations: { lines: true },
      order: { createdAt: 'DESC', lines: { lineNo: 'ASC' } },
      take: 200,
    });
  }

  async findOne(plantId: string, id: string, em?: EntityManager): Promise<Inquiry> {
    const repo = (em ?? this.db).getRepository(Inquiry);
    const inquiry = await repo.findOne({
      where: { id, plantId },
      relations: { lines: true },
      order: { lines: { lineNo: 'ASC' } },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    return inquiry;
  }

  async update(s: Scope, id: string, dto: UpdateInquiryDto): Promise<Inquiry> {
    const inquiry = await this.findOne(s.plantId, id);
    Object.assign(inquiry, dto, { updatedBy: s.userId });
    await this.db.getRepository(Inquiry).save(inquiry);
    return this.findOne(s.plantId, id);
  }

  async replaceLines(s: Scope, id: string, lines: InquiryLineDto[]): Promise<Inquiry> {
    await this.db.transaction(async (em) => {
      await this.findOne(s.plantId, id, em); // 404 if missing / wrong plant
      await em.delete(InquiryLine, { inquiryId: id });
      await em.save(this.buildLines(em, id, lines));
      await em.update(Inquiry, { id }, { updatedBy: s.userId });
    });
    return this.findOne(s.plantId, id);
  }

  async sendToEstimation(s: Scope, id: string, dto: SendToEstimationDto): Promise<Inquiry> {
    const inquiry = await this.findOne(s.plantId, id);
    this.assertTransition(inquiry.status, 'estimating');
    inquiry.status = 'estimating';
    inquiry.estimatorId = dto.estimatorId;
    inquiry.updatedBy = s.userId;
    await this.db.getRepository(Inquiry).save(inquiry);
    return this.findOne(s.plantId, id);
  }

  async recordOutcome(s: Scope, id: string, dto: InquiryOutcomeDto): Promise<Inquiry> {
    const inquiry = await this.findOne(s.plantId, id);
    this.assertTransition(inquiry.status, dto.status);
    inquiry.status = dto.status;
    inquiry.lostReason = dto.status === 'lost' ? dto.lostReason : undefined;
    inquiry.updatedBy = s.userId;
    await this.db.getRepository(Inquiry).save(inquiry);
    return this.findOne(s.plantId, id);
  }

  // --- helpers -----------------------------------------------------------
  private buildLines(em: EntityManager, inquiryId: string, lines: InquiryLineDto[]): InquiryLine[] {
    return lines.map((line, i) => em.create(InquiryLine, { ...line, inquiryId, lineNo: i + 1 }));
  }

  /** Allowed inquiry status transitions (cancellation is via 'cancelled'). */
  private static readonly ALLOWED: Record<InquiryStatus, InquiryStatus[]> = {
    new: ['estimating', 'quoted', 'won', 'lost', 'cancelled'],
    estimating: ['quoted', 'won', 'lost', 'cancelled'],
    quoted: ['won', 'lost', 'cancelled'],
    won: [],
    lost: [],
    cancelled: [],
  };

  private assertTransition(from: InquiryStatus, to: InquiryStatus): void {
    if (!InquiriesService.ALLOWED[from]?.includes(to)) {
      throw new BadRequestException(`Cannot move inquiry from '${from}' to '${to}'`);
    }
  }
}
