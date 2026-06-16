import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.entity';
import { Customer } from '../customers/customer.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Customer]), DocSequenceModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
