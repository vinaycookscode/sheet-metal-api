import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Global interceptor: records an audit_log row for every successful mutating request. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    if (!MUTATING.has(req.method)) return next.handle();
    const user = req.user as AuthUser | undefined;

    return next.handle().pipe(
      tap((body) => {
        if (!user?.orgId) return;
        const url = String(req.originalUrl || req.url || '').split('?')[0];
        const segs = url.split('/').filter(Boolean); // e.g. ['api','sales-orders','<id>','status']
        const entityType = segs[1] || 'unknown';
        const last = segs[segs.length - 1] || '';
        const bodyId = body && typeof body === 'object' ? (body as { id?: string }).id : undefined;
        const entityId = bodyId || req.params?.id;

        let action: string;
        if (req.method === 'DELETE') action = 'delete';
        else if (req.method === 'PATCH' || req.method === 'PUT') action = 'update';
        else {
          // POST: a trailing verb after an id (…/:id/issue) is an action; otherwise it's a create.
          const prevIsId = segs.length >= 2 && UUID_RE.test(segs[segs.length - 2] || '');
          action = !UUID_RE.test(last) && last !== entityType && prevIsId ? last : 'create';
        }

        void this.audit
          .record({ orgId: user.orgId, actorId: user.userId, entityType, entityId, action, after: body })
          .catch(() => undefined);
      }),
    );
  }
}
