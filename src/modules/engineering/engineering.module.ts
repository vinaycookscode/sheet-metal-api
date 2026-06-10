import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Part } from './part.entity';
import { RoutingOp } from './routing-op.entity';
import { BomLine } from './bom-line.entity';
import { EngineeringService } from './engineering.service';
import { EngineeringController } from './engineering.controller';
import { DocumentsModule } from '../documents/documents.module';

/**
 * Engineering (SM-130–133): rev-controlled parts, routing, multi-level BOM,
 * and engineering release (locks the part + flips an SO line to released_to_plan).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Part, RoutingOp, BomLine]), DocumentsModule],
  controllers: [EngineeringController],
  providers: [EngineeringService],
  exports: [EngineeringService],
})
export class EngineeringModule {}
