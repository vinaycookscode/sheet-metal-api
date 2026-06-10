import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DocumentsService, UploadedFileLike } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    if (!entityType || !entityId) throw new BadRequestException('entityType and entityId are required');
    return this.service.list(u.orgId, entityType, entityId);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @CurrentUser() u: AuthUser,
    @UploadedFile() file: UploadedFileLike,
    @Body() body: { entityType: string; entityId: string; kind?: string; entityRef?: string },
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (!body.entityType || !body.entityId) throw new BadRequestException('entityType and entityId are required');
    return this.service.upload(
      { orgId: u.orgId, userId: u.userId },
      { entityType: body.entityType, entityId: body.entityId, kind: body.kind || 'attachment', entityRef: body.entityRef },
      file,
    );
  }

  @Get(':id/download')
  async download(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { doc, stream } = await this.service.stream(u.orgId, id);
    res.set({
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${doc.fileName.replace(/"/g, '')}"`,
    });
    return new StreamableFile(stream);
  }

  @Post(':id/review')
  review(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: { status: 'approved' | 'rejected' }) {
    const status = body?.status === 'approved' ? 'approved' : 'rejected';
    return this.service.review(u.orgId, id, status, u.userId);
  }

  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.remove(u.orgId, id);
  }
}
