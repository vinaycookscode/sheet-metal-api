import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';

import { typeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ItemsModule } from './modules/items/items.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { DocSequenceModule } from './modules/doc-sequence/doc-sequence.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { SalesOrdersModule } from './modules/sales-orders/sales-orders.module';
import { EngineeringModule } from './modules/engineering/engineering.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PlanningModule } from './modules/planning/planning.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ProductionModule } from './modules/production/production.module';
import { QualityModule } from './modules/quality/quality.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { FinanceModule } from './modules/finance/finance.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';

/**
 * Modular monolith — one domain module per M# in PRODUCT-PLAN.md §4.
 * Implemented so far: auth (platform), customers (reference vertical slice).
 *
 * Add the remaining domain modules as they are built, e.g.:
 *   InquiriesModule, QuotesModule, SalesOrdersModule, EngineeringModule,
 *   PlanningModule, ProcurementModule, InventoryModule, ProductionModule,
 *   QualityModule, DispatchModule, FinanceModule, MasterDataModule,
 *   DocumentsModule, NotificationsModule.
 * Each follows the customers/ pattern: entity → dto → service → controller → module.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().optional(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('1h'),
      }).unknown(true),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => typeOrmConfig(config),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    DocSequenceModule,
    MasterDataModule,
    CustomersModule,
    SuppliersModule,
    ItemsModule,
    InquiriesModule,
    QuotesModule,
    SalesOrdersModule,
    EngineeringModule,
    InventoryModule,
    PlanningModule,
    ProcurementModule,
    ProductionModule,
    QualityModule,
    DispatchModule,
    FinanceModule,
    DocumentsModule,
    AuditModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
