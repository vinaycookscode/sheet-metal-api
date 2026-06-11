import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { ClosureService } from './closure.service';
import { ApService } from './ap.service';
import { CreateInvoiceDto, CreateSupplierInvoiceDto, RecordPaymentDto, RecordVendorPaymentDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

const full = (u: AuthUser) => ({ orgId: u.orgId, plantId: u.plantId as string, userId: u.userId });
const ps = (u: AuthUser) => ({ plantId: u.plantId as string, userId: u.userId });

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @Get()
  @RequirePermission('invoice.read')
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('customerId') customerId?: string) {
    return this.service.list(u.plantId as string, { status, customerId });
  }

  @Get(':id')
  @RequirePermission('invoice.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.findOne(u.plantId as string, id);
  }

  @Get(':id/document')
  @RequirePermission('invoice.read')
  document(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.document(u.plantId as string, id);
  }

  @Post()
  @RequirePermission('invoice.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.service.create(full(u), dto);
  }

  @Post('from-shipment/:shipmentId')
  @RequirePermission('invoice.write')
  fromShipment(@CurrentUser() u: AuthUser, @Param('shipmentId') shipmentId: string) {
    return this.service.fromShipment(full(u), shipmentId);
  }

  @Post(':id/issue')
  @RequirePermission('invoice.write')
  issue(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.issue(full(u), id);
  }
}

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Get()
  @RequirePermission('payment.read')
  list(@CurrentUser() u: AuthUser, @Query('customerId') customerId?: string, @Query('invoiceId') invoiceId?: string) {
    return this.service.list(u.plantId as string, { customerId, invoiceId });
  }

  @Get('ar-aging')
  @RequirePermission('payment.read')
  aging(@CurrentUser() u: AuthUser) {
    return this.service.arAging(u.plantId as string);
  }

  @Post()
  @RequirePermission('payment.write')
  record(@CurrentUser() u: AuthUser, @Body() dto: RecordPaymentDto) {
    return this.service.record(ps(u), dto);
  }
}

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('closure')
export class ClosureController {
  constructor(private readonly service: ClosureService) {}

  @Get('sales-orders/:id')
  @RequirePermission('closure.read')
  report(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.report(u.plantId as string, id);
  }

  @Post('sales-orders/:id/close')
  @RequirePermission('closure.write')
  close(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.close(ps(u), id);
  }
}

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('supplier-invoices')
export class SupplierInvoiceController {
  constructor(private readonly service: ApService) {}

  @Get()
  @RequirePermission('payment.read')
  list(@CurrentUser() u: AuthUser) {
    return this.service.list(u.plantId as string);
  }

  @Post('from-po/:poId')
  @RequirePermission('payment.write')
  create(@CurrentUser() u: AuthUser, @Param('poId') poId: string, @Body() dto: CreateSupplierInvoiceDto) {
    return this.service.createFromPo(full(u), poId, dto);
  }

  @Post(':id/match')
  @RequirePermission('payment.write')
  match(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.match(u.plantId as string, id);
  }

  @Post(':id/approve')
  @RequirePermission('payment.write')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.approve(u.plantId as string, id);
  }
}

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('vendor-payments')
export class VendorPaymentController {
  constructor(private readonly service: ApService) {}

  @Get('ap-aging')
  @RequirePermission('payment.read')
  aging(@CurrentUser() u: AuthUser) {
    return this.service.apAging(u.plantId as string);
  }

  @Post()
  @RequirePermission('payment.write')
  record(@CurrentUser() u: AuthUser, @Body() dto: RecordVendorPaymentDto) {
    return this.service.recordPayment(full(u), dto);
  }
}
