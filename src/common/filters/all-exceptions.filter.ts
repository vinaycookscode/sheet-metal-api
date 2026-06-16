import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Single normalized error shape for the whole API:
 *   { statusCode, code, message, action?, path, timestamp }
 *
 * - `message` is preserved verbatim (string OR class-validator string[]), so existing
 *   clients that read `error.message` keep working.
 * - `code` + `action` are carried through from {@link BlockedException} so the web
 *   BlockerBanner can render a reason + a one-click fix.
 * This only *wraps* errors; it never changes status codes or validation semantics.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code: string | undefined;
    let action: unknown;
    let blocked = false;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? message;
        code = b.code as string | undefined;
        action = b.action;
        blocked = b.blocked === true;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Only 5xx are unexpected — log those with a stack; 4xx are normal business flow.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, (exception as Error)?.stack);
    }

    res.status(status).json({
      statusCode: status,
      ...(code ? { code } : {}),
      ...(blocked ? { blocked: true } : {}),
      message,
      ...(action ? { action } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
