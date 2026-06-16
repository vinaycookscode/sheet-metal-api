import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Project } from './project.entity';
import { ProjectStatus } from '../../common/enums';
import { Customer } from '../customers/customer.entity';
import { Inquiry } from '../inquiries/inquiry.entity';
import { Quote } from '../quotes/quote.entity';
import { SalesOrder } from '../sales-orders/sales-order.entity';
import { SoLine } from '../sales-orders/so-line.entity';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

interface ListFilter {
  customerId?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly repo: Repository<Project>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
  ) {}

  async list(orgId: string, filter: ListFilter = {}) {
    const base: FindOptionsWhere<Project> = {
      orgId,
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.status ? { status: filter.status as ProjectStatus } : {}),
    };
    const where = filter.search
      ? [
          { ...base, name: ILike(`%${filter.search}%`) },
          { ...base, code: ILike(`%${filter.search}%`) },
        ]
      : base;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async get(orgId: string, id: string) {
    const project = await this.repo.findOne({ where: { id, orgId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(orgId: string, plantId: string, userId: string, dto: CreateProjectDto) {
    const customer = await this.customers.findOne({ where: { id: dto.customerId, orgId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const code = dto.code ?? (await this.docSeq.allocate(plantId, 'PRJ'));
    const existing = await this.repo.findOne({ where: { orgId, code } });
    if (existing) throw new ConflictException(`Project code ${code} already exists`);

    const project = this.repo.create({
      orgId,
      plantId,
      customerId: dto.customerId,
      code,
      name: dto.name,
      status: dto.status ?? 'active',
      description: dto.description,
      targetDate: dto.targetDate,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.repo.save(project);
  }

  /** Create several at once (each gets its own auto code when omitted). */
  async bulkCreate(orgId: string, plantId: string, userId: string, dtos: CreateProjectDto[]) {
    const created: Project[] = [];
    for (const dto of dtos) created.push(await this.create(orgId, plantId, userId, dto));
    return created;
  }

  async update(orgId: string, userId: string, id: string, dto: UpdateProjectDto) {
    const project = await this.get(orgId, id);
    Object.assign(project, dto, { updatedBy: userId });
    return this.repo.save(project);
  }

  async remove(orgId: string, id: string) {
    const project = await this.get(orgId, id);
    await this.repo.softRemove(project);
    return { id, deleted: true };
  }

  /** Rollup for the project detail screen: counts across the chain + open-order value. */
  async summary(orgId: string, id: string) {
    const project = await this.get(orgId, id);
    const customer = await this.customers.findOne({ where: { id: project.customerId } });

    const [inquiries, quotes, salesOrders] = await Promise.all([
      this.db.getRepository(Inquiry).count({ where: { projectId: id } }),
      this.db.getRepository(Quote).count({ where: { projectId: id } }),
      this.db.getRepository(SalesOrder).count({ where: { projectId: id } }),
    ]);

    const openSalesOrders = await this.db
      .getRepository(SalesOrder)
      .createQueryBuilder('so')
      .where('so.project_id = :id', { id })
      .andWhere("so.status NOT IN ('closed', 'cancelled')")
      .getCount();

    const valueRow = await this.db
      .getRepository(SoLine)
      .createQueryBuilder('sl')
      .innerJoin('sales_order', 'so', 'so.id = sl.sales_order_id')
      .where('so.project_id = :id', { id })
      .select('COALESCE(SUM(sl.qty * sl.unit_price), 0)', 'total')
      .getRawOne<{ total: string }>();

    return {
      project,
      customer: customer ? { id: customer.id, name: customer.name, code: customer.code } : null,
      counts: { inquiries, quotes, salesOrders, openSalesOrders },
      orderValue: Number(valueRow?.total ?? 0),
    };
  }
}
