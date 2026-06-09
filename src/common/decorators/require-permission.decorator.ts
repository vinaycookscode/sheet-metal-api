import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

/**
 * Declares the permission code a route requires, e.g.
 *   @RequirePermission('quote.approve')
 * Enforced by PermissionsGuard. Mirrors medpilot's permission model.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
