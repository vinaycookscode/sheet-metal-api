import { Injectable, Logger } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream, promises as fs } from 'fs';
import { dirname, join } from 'path';
import { Readable } from 'stream';

/**
 * Document blob storage. Uses **Cloudflare R2** (S3-compatible) when the R2_* env
 * vars are set; otherwise falls back to local disk (DOCS_DIR) so dev works without creds.
 *
 * Required env for R2: R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * (optional R2_ENDPOINT to override the default `https://<account>.r2.cloudflarestorage.com`).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly localDir = process.env.DOCS_DIR || join(process.cwd(), 'uploads');
  private readonly bucket = process.env.R2_BUCKET;
  private readonly s3: S3Client | null;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (this.bucket && accountId && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`Document storage: Cloudflare R2 bucket "${this.bucket}"`);
    } else {
      this.s3 = null;
      this.logger.log(`Document storage: local disk (${this.localDir}) — set R2_* env vars to use Cloudflare R2`);
    }
  }

  get driver(): 'r2' | 'local' {
    return this.s3 ? 'r2' : 'local';
  }

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
    } else {
      const abs = join(this.localDir, key);
      await fs.mkdir(dirname(abs), { recursive: true });
      await fs.writeFile(abs, body);
    }
  }

  async getStream(key: string): Promise<Readable> {
    if (this.s3) {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.Body as Readable;
    }
    return createReadStream(join(this.localDir, key));
  }

  async delete(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } else {
      await fs.rm(join(this.localDir, key), { force: true });
    }
  }
}
