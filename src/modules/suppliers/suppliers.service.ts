import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../../common/crud/crud.service';
import { Supplier } from './supplier.entity';

@Injectable()
export class SuppliersService extends CrudService<Supplier> {
  constructor(@InjectRepository(Supplier) repo: Repository<Supplier>) {
    super(repo, {
      scopeField: 'orgId',
      uniqueField: 'code',
      label: 'Supplier',
      searchFields: ['code', 'name'],
      orderBy: { name: 'ASC' },
      audit: true,
      softDelete: true,
    });
  }
}
