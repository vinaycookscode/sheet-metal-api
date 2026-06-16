import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    private readonly docSeq: DocSequenceService,
  ) {}

  async list(orgId: string, search?: string) {
    return this.repo.find({
      where: search
        ? [
            { orgId, name: ILike(`%${search}%`) },
            { orgId, code: ILike(`%${search}%`) },
          ]
        : { orgId },
      order: { name: 'ASC' },
      take: 200,
    });
  }

  async get(orgId: string, id: string) {
    const customer = await this.repo.findOne({ where: { id, orgId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(orgId: string, plantId: string, userId: string, dto: CreateCustomerDto) {
    const code = dto.code ?? (await this.docSeq.allocate(plantId, 'CUST'));
    const existing = await this.repo.findOne({ where: { orgId, code } });
    if (existing) throw new ConflictException(`Customer code ${code} already exists`);

    const customer = this.repo.create({ ...dto, code, orgId, createdBy: userId, updatedBy: userId });
    return this.repo.save(customer);
  }

  /** Create several customers at once (each gets an auto code when omitted). */
  async bulkCreate(orgId: string, plantId: string, userId: string, dtos: CreateCustomerDto[]) {
    const created: Customer[] = [];
    for (const dto of dtos) created.push(await this.create(orgId, plantId, userId, dto));
    return created;
  }

  async update(orgId: string, userId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.get(orgId, id);
    Object.assign(customer, dto, { updatedBy: userId });
    return this.repo.save(customer);
  }

  async remove(orgId: string, id: string) {
    const customer = await this.get(orgId, id);
    await this.repo.softRemove(customer);
    return { id, deleted: true };
  }
}
