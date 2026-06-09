import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../../common/crud/crud.service';
import { Finish, MaterialGrade, Operation, TaxCode, Uom, WorkCenter } from './entities';

@Injectable()
export class UomService extends CrudService<Uom> {
  constructor(@InjectRepository(Uom) repo: Repository<Uom>) {
    super(repo, { uniqueField: 'code', label: 'UoM', searchFields: ['code', 'name'], orderBy: { code: 'ASC' } });
  }
}

@Injectable()
export class TaxCodeService extends CrudService<TaxCode> {
  constructor(@InjectRepository(TaxCode) repo: Repository<TaxCode>) {
    super(repo, { uniqueField: 'hsnSac', label: 'Tax code', searchFields: ['hsnSac', 'description'], orderBy: { hsnSac: 'ASC' } });
  }
}

@Injectable()
export class MaterialGradeService extends CrudService<MaterialGrade> {
  constructor(@InjectRepository(MaterialGrade) repo: Repository<MaterialGrade>) {
    super(repo, { scopeField: 'orgId', uniqueField: 'code', label: 'Material grade', searchFields: ['code', 'name'], orderBy: { code: 'ASC' } });
  }
}

@Injectable()
export class FinishService extends CrudService<Finish> {
  constructor(@InjectRepository(Finish) repo: Repository<Finish>) {
    super(repo, { scopeField: 'orgId', uniqueField: 'code', label: 'Finish', searchFields: ['code', 'name'], orderBy: { code: 'ASC' } });
  }
}

@Injectable()
export class WorkCenterService extends CrudService<WorkCenter> {
  constructor(@InjectRepository(WorkCenter) repo: Repository<WorkCenter>) {
    super(repo, { scopeField: 'plantId', uniqueField: 'code', label: 'Work center', searchFields: ['code', 'name'], orderBy: { code: 'ASC' } });
  }
}

@Injectable()
export class OperationService extends CrudService<Operation> {
  constructor(@InjectRepository(Operation) repo: Repository<Operation>) {
    super(repo, { scopeField: 'orgId', uniqueField: 'code', label: 'Operation', searchFields: ['code', 'name'], orderBy: { code: 'ASC' } });
  }
}
