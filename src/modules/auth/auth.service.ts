import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Minimal auth: validate credentials against app_user, resolve the user's
 * effective permission codes (via user_role → role_permission → permission),
 * and mint a JWT carrying orgId/plantId/permissions for the guards to use.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const rows = await this.db.query(
      `SELECT id, org_id, default_plant_id, password_hash, is_active, full_name
         FROM app_user WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    const user = rows[0];
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const perms = await this.db.query(
      `SELECT DISTINCT p.code
         FROM user_role ur
         JOIN role_permission rp ON rp.role_id = ur.role_id
         JOIN permission p ON p.id = rp.permission_id
        WHERE ur.user_id = $1`,
      [user.id],
    );
    const permissions = perms.map((r: { code: string }) => r.code);

    const payload = {
      sub: user.id,
      orgId: user.org_id,
      plantId: user.default_plant_id,
      permissions,
    };

    return {
      accessToken: await this.jwt.signAsync(payload, {
        expiresIn: this.config.get('JWT_EXPIRES_IN', '1h'),
      }),
      refreshToken: await this.jwt.signAsync(
        { sub: user.id },
        { expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d') },
      ),
      user: { id: user.id, fullName: user.full_name, orgId: user.org_id, permissions },
    };
  }
}
