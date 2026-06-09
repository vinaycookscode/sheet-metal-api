import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
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

  async create(orgId: string, userId: string, dto: CreateCustomerDto) {
    const existing = await this.repo.findOne({ where: { orgId, code: dto.code } });
    if (existing) throw new ConflictException(`Customer code ${dto.code} already exists`);

    const customer = this.repo.create({ ...dto, orgId, createdBy: userId, updatedBy: userId });
    return this.repo.save(customer);
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
