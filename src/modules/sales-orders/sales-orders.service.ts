import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { SalesOrder } from './sales-order.entity';
import { SoLine } from './so-line.entity';
import { SoStatus } from '../../common/enums';
import { CreateSalesOrderDto, FromQuoteDto, SoLineDto, SoStatusDto, UpdateSalesOrderDto } from './dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

@Injectable()
export class SalesOrdersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
  ) {}

  async create(s: Scope, dto: CreateSalesOrderDto): Promise<SalesOrder> {
    const id = await this.db.transaction(async (em) => {
      const number = await this.docSeq.allocate(s.plantId, 'SO', em);
      const so = em.create(SalesOrder, {
        orgId: s.orgId,
        plantId: s.plantId,
        number,
        customerId: dto.customerId,
        customerPoNumber: dto.customerPoNumber,
        status: 'confirmed',
        orderDate: dto.orderDate,
        createdBy: s.userId,
        updatedBy: s.userId,
      });
      await em.save(so);
      await em.save(this.buildLines(em, so.id, dto.lines));
      return so.id;
    });
    return this.findOne(s.plantId, id);
  }

  /** One-click Quote → Sales Order (SM-120): carry pricing + lines, no re-keying. */
  async fromQuote(s: Scope, quoteVersionId: string, body: FromQuoteDto): Promise<SalesOrder> {
    const id = await this.db.transaction(async (em) => {
      const qv = (await em.query(
        `SELECT qv.id, qv.quote_id, q.customer_id
           FROM quote_version qv JOIN quote q ON q.id = qv.quote_id
          WHERE qv.id = $1 AND q.plant_id = $2`,
        [quoteVersionId, s.plantId],
      )) as Array<{ id: string; quote_id: string; customer_id: string }>;
      if (!qv[0]) throw new NotFoundException('Quote version not found');

      const qLines = (await em.query(
        `SELECT id, part_name, primary_qty, unit_price, tax_code_id
           FROM quote_line WHERE quote_version_id = $1 ORDER BY line_no`,
        [quoteVersionId],
      )) as Array<{ id: string; part_name: string; primary_qty: string; unit_price: string; tax_code_id: string | null }>;
      if (!qLines.length) throw new BadRequestException('Quote version has no lines');

      const number = await this.docSeq.allocate(s.plantId, 'SO', em);
      const so = em.create(SalesOrder, {
        orgId: s.orgId,
        plantId: s.plantId,
        number,
        customerId: qv[0].customer_id,
        quoteVersionId,
        customerPoNumber: body.customerPoNumber,
        status: 'confirmed',
        createdBy: s.userId,
        updatedBy: s.userId,
      });
      await em.save(so);

      const lines = qLines.map((r, i) =>
        em.create(SoLine, {
          salesOrderId: so.id,
          lineNo: i + 1,
          quoteLineId: r.id,
          partName: r.part_name,
          qty: Number(r.primary_qty),
          unitPrice: Number(r.unit_price),
          taxCodeId: r.tax_code_id ?? undefined,
          status: 'open',
        }),
      );
      await em.save(lines);

      // mark the quote accepted (best-effort, same plant)
      await em.query(
        `UPDATE quote SET status = 'accepted', updated_by = $3
          WHERE id = $1 AND plant_id = $2 AND status IN ('draft', 'sent')`,
        [qv[0].quote_id, s.plantId, s.userId],
      );
      return so.id;
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { status?: string; customerId?: string }): Promise<SalesOrder[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    return this.db.getRepository(SalesOrder).find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(plantId: string, id: string): Promise<SalesOrder> {
    const so = await this.db.getRepository(SalesOrder).findOne({
      where: { id, plantId },
      relations: { lines: true },
      order: { lines: { lineNo: 'ASC' } },
    });
    if (!so) throw new NotFoundException('Sales order not found');
    return so;
  }

  async update(s: Scope, id: string, dto: UpdateSalesOrderDto): Promise<SalesOrder> {
    const so = await this.findOne(s.plantId, id);
    Object.assign(so, dto, { updatedBy: s.userId });
    await this.db.getRepository(SalesOrder).save(so);
    return this.findOne(s.plantId, id);
  }

  async setStatus(s: Scope, id: string, dto: SoStatusDto): Promise<SalesOrder> {
    const repo = this.db.getRepository(SalesOrder);
    const so = await repo.findOne({ where: { id, plantId: s.plantId } });
    if (!so) throw new NotFoundException('Sales order not found');
    this.assertTransition(so.status, dto.status);
    so.status = dto.status;
    so.updatedBy = s.userId;
    await repo.save(so);
    return this.findOne(s.plantId, id);
  }

  // --- helpers -----------------------------------------------------------
  private buildLines(em: EntityManager, salesOrderId: string, lines: SoLineDto[]): SoLine[] {
    return lines.map((line, i) =>
      em.create(SoLine, { ...line, salesOrderId, lineNo: i + 1, status: 'open' }),
    );
  }

  private static readonly ALLOWED: Record<SoStatus, SoStatus[]> = {
    confirmed: ['in_production', 'cancelled'],
    in_production: ['dispatched', 'cancelled'],
    dispatched: ['invoiced'],
    invoiced: ['closed'],
    closed: [],
    cancelled: [],
  };

  private assertTransition(from: SoStatus, to: SoStatus): void {
    if (!SalesOrdersService.ALLOWED[from]?.includes(to)) {
      throw new BadRequestException(`Cannot move sales order from '${from}' to '${to}'`);
    }
  }
}
