import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocSequenceService } from './doc-sequence.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('doc-sequences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('doc-sequences')
export class DocSequenceController {
  constructor(private readonly service: DocSequenceService) {}

  /** Counters configured for the caller's plant. */
  @Get()
  @RequirePermission('docseq.read')
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.plantId as string);
  }

  /** Allocate (consume) the next number for a doc type — mainly internal/testing. */
  @Post(':docType/allocate')
  @RequirePermission('docseq.write')
  async allocate(@CurrentUser() user: AuthUser, @Param('docType') docType: string) {
    const number = await this.service.allocate(user.plantId as string, docType.toUpperCase());
    return { number };
  }
}
