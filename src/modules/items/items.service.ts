import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../../common/crud/crud.service';
import { Item } from './item.entity';

@Injectable()
export class ItemsService extends CrudService<Item> {
  constructor(@InjectRepository(Item) repo: Repository<Item>) {
    super(repo, {
      scopeField: 'orgId',
      uniqueField: 'code',
      label: 'Item',
      searchFields: ['code', 'name'],
      orderBy: { code: 'ASC' },
      audit: true,
      softDelete: true,
    });
  }
}
