import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLog } from './audit-log.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SENSITIVE = ['password', 'passwordHash', 'password_hash', 'accessToken', 'refreshToken', 'secret'];

export interface AuditInput {
  orgId: string;
  actorId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  after?: unknown;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Best-effort, non-blocking write. Skips when entityId isn't a UUID (non-entity actions). */
  async record(input: AuditInput): Promise<void> {
    if (!input.entityId || !UUID_RE.test(input.entityId)) return;
    try {
      const repo = this.db.getRepository(AuditLog);
      const row = repo.create({
        orgId: input.orgId,
        actorId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: (input.action || 'update').slice(0, 16),
      });
      row.after = this.sanitize(input.after);
      await repo.save(row);
    } catch (e) {
      this.logger.warn(`audit write failed: ${(e as Error).message}`);
    }
  }

  async list(orgId: string, filter: { entityType?: string; entityId?: string; actorId?: string; limit?: number }) {
    const where: string[] = ['a.org_id = $1'];
    const params: unknown[] = [orgId];
    let i = 2;
    if (filter.entityType) { where.push(`a.entity_type = $${i++}`); params.push(filter.entityType); }
    if (filter.entityId) { where.push(`a.entity_id = $${i++}`); params.push(filter.entityId); }
    if (filter.actorId) { where.push(`a.actor_id = $${i++}`); params.push(filter.actorId); }
    const limit = Math.min(filter.limit || 100, 500);
    return this.db.query(
      `SELECT a.id, a.entity_type AS "entityType", a.entity_id AS "entityId", a.action,
              a.after, a.at, a.actor_id AS "actorId", u.full_name AS "actorName"
         FROM audit_log a
         LEFT JOIN app_user u ON u.id = a.actor_id
        WHERE ${where.join(' AND ')}
        ORDER BY a.id DESC
        LIMIT ${limit}`,
      params,
    );
  }

  private sanitize(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== 'object') return null;
    try {
      const clone = JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
      const strip = (o: unknown): void => {
        if (o && typeof o === 'object') {
          for (const k of Object.keys(o as Record<string, unknown>)) {
            if (SENSITIVE.includes(k)) delete (o as Record<string, unknown>)[k];
            else strip((o as Record<string, unknown>)[k]);
          }
        }
      };
      strip(clone);
      return clone;
    } catch {
      return null;
    }
  }
}
