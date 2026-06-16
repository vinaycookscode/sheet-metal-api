import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { BulkCreateCustomersDto, CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @RequirePermission('customer.read')
  list(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.service.list(user.orgId, search);
  }

  @Get(':id')
  @RequirePermission('customer.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.orgId, id);
  }

  @Post()
  @RequirePermission('customer.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.service.create(user.orgId, user.plantId as string, user.userId, dto);
  }

  @Post('bulk')
  @RequirePermission('customer.write')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkCreateCustomersDto) {
    return this.service.bulkCreate(user.orgId, user.plantId as string, user.userId, dto.customers);
  }

  @Patch(':id')
  @RequirePermission('customer.write')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.service.update(user.orgId, user.userId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('customer.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.orgId, id);
  }
}
