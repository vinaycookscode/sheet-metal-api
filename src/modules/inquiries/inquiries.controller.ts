import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InquiriesService } from './inquiries.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import {
  InquiryOutcomeDto,
  ReplaceLinesDto,
  SendToEstimationDto,
  UpdateInquiryDto,
} from './dto/update-inquiry.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('inquiries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly service: InquiriesService) {}

  private scope(u: AuthUser) {
    return { orgId: u.orgId, plantId: u.plantId as string, userId: u.userId };
  }

  @Get()
  @RequirePermission('inquiry.read')
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('customerId') customerId?: string) {
    return this.service.list(u.plantId as string, { status, customerId });
  }

  @Get(':id')
  @RequirePermission('inquiry.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.findOne(u.plantId as string, id);
  }

  @Post()
  @RequirePermission('inquiry.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateInquiryDto) {
    return this.service.create(this.scope(u), dto);
  }

  @Patch(':id')
  @RequirePermission('inquiry.write')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateInquiryDto) {
    return this.service.update(this.scope(u), id, dto);
  }

  @Put(':id/lines')
  @RequirePermission('inquiry.write')
  replaceLines(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReplaceLinesDto) {
    return this.service.replaceLines(this.scope(u), id, dto.lines);
  }

  @Post(':id/send-to-estimation')
  @RequirePermission('inquiry.write')
  sendToEstimation(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SendToEstimationDto) {
    return this.service.sendToEstimation(this.scope(u), id, dto);
  }

  @Post(':id/outcome')
  @RequirePermission('inquiry.write')
  outcome(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: InquiryOutcomeDto) {
    return this.service.recordOutcome(this.scope(u), id, dto);
  }
}
