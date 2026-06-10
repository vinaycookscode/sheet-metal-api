import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { DocumentEntity } from './document.entity';
import { StorageService } from './storage.service';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
interface Scope {
  orgId: string;
  userId: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity) private readonly repo: Repository<DocumentEntity>,
    private readonly storage: StorageService,
  ) {}

  /** Upload a file for an entity; auto-versions when the same file name is re-uploaded. */
  async upload(
    s: Scope,
    dto: { entityType: string; entityId: string; kind: string; entityRef?: string },
    file: UploadedFileLike,
  ): Promise<DocumentEntity> {
    const prior = await this.repo.findOne({
      where: { orgId: s.orgId, entityType: dto.entityType, entityId: dto.entityId, fileName: file.originalname },
      order: { version: 'DESC' },
    });
    const version = prior ? prior.version + 1 : 1;

    // Human-readable object key: <entityType>/<business-ref or id>/v<n>_<file>.
    // The business ref (part no, INQ/SO/DC/PO/INV number) makes the bucket browsable.
    const slug = (v: string) => v.trim().replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '');
    const ref = dto.entityRef && slug(dto.entityRef) ? slug(dto.entityRef) : dto.entityId;
    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
    const storageKey = `${dto.entityType}/${ref}/v${version}_${safeName}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);

    const doc = this.repo.create({
      orgId: s.orgId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      kind: dto.kind || 'attachment',
      fileName: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      version,
      uploadedBy: s.userId,
    });
    return this.repo.save(doc);
  }

  list(orgId: string, entityType: string, entityId: string): Promise<DocumentEntity[]> {
    return this.repo.find({ where: { orgId, entityType, entityId }, order: { createdAt: 'DESC' } });
  }

  /** Resolve a document and open a readable stream from storage (R2 or local disk). */
  async stream(orgId: string, id: string): Promise<{ doc: DocumentEntity; stream: Readable }> {
    const doc = await this.repo.findOne({ where: { id, orgId } });
    if (!doc) throw new NotFoundException('Document not found');
    return { doc, stream: await this.storage.getStream(doc.storageKey) };
  }

  async remove(orgId: string, id: string): Promise<void> {
    const doc = await this.repo.findOne({ where: { id, orgId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.repo.softRemove(doc);
  }
}
