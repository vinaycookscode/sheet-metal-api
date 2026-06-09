import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MASTER_DATA_ENTITIES } from './entities';
import { MASTER_DATA_CONTROLLERS } from './master-data.controller';
import {
  FinishService,
  MaterialGradeService,
  OperationService,
  TaxCodeService,
  UomService,
  WorkCenterService,
} from './services';

const SERVICES = [
  UomService,
  TaxCodeService,
  MaterialGradeService,
  FinishService,
  WorkCenterService,
  OperationService,
];

/**
 * Master-data lookups (SM-012): UoM, tax codes, material grades, finishes,
 * work centers, operations — the configurable option lists the rest of the
 * domain binds to. One module; one thin controller per lookup.
 */
@Module({
  imports: [TypeOrmModule.forFeature(MASTER_DATA_ENTITIES)],
  controllers: MASTER_DATA_CONTROLLERS,
  providers: SERVICES,
  exports: SERVICES,
})
export class MasterDataModule {}
