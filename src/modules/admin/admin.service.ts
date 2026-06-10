import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateRoleDto, CreateUserDto, SetPermissionsDto, SetRolesDto, UpdateUserDto } from './dto';

@Injectable()
export class AdminService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // --- Users ---------------------------------------------------------------
  listUsers(orgId: string) {
    return this.db.query(
      `SELECT u.id, u.email, u.full_name AS "fullName", u.is_active AS "isActive",
              u.default_plant_id AS "defaultPlantId",
              COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
         FROM app_user u
         LEFT JOIN user_role ur ON ur.user_id = u.id
         LEFT JOIN role r ON r.id = ur.role_id
        WHERE u.org_id = $1
        GROUP BY u.id
        ORDER BY u.email`,
      [orgId],
    );
  }

  async createUser(orgId: string, dto: CreateUserDto) {
    const exists = (await this.db.query(`SELECT 1 FROM app_user WHERE lower(email) = lower($1)`, [dto.email])) as unknown[];
    if (exists.length) throw new BadRequestException('A user with this email already exists');
    const hash = await bcrypt.hash(dto.password, 10);
    const rows = (await this.db.query(
      `INSERT INTO app_user (org_id, email, full_name, password_hash, is_active, default_plant_id)
       VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
      [orgId, dto.email, dto.fullName, hash, dto.defaultPlantId ?? null],
    )) as Array<{ id: string }>;
    const id = rows[0].id;
    await this.assignRoles(orgId, id, dto.roleIds ?? []);
    return { id };
  }

  async updateUser(orgId: string, id: string, dto: UpdateUserDto) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (dto.fullName !== undefined) { sets.push(`full_name = $${i++}`); params.push(dto.fullName); }
    if (dto.isActive !== undefined) { sets.push(`is_active = $${i++}`); params.push(dto.isActive); }
    if (dto.defaultPlantId !== undefined) { sets.push(`default_plant_id = $${i++}`); params.push(dto.defaultPlantId || null); }
    if (!sets.length) return { ok: true };
    params.push(id, orgId);
    const res = await this.db.query(`UPDATE app_user SET ${sets.join(', ')} WHERE id = $${i++} AND org_id = $${i}`, params);
    if (!res) throw new NotFoundException('User not found');
    return { ok: true };
  }

  async setUserRoles(orgId: string, id: string, dto: SetRolesDto) {
    const u = (await this.db.query(`SELECT 1 FROM app_user WHERE id = $1 AND org_id = $2`, [id, orgId])) as unknown[];
    if (!u.length) throw new NotFoundException('User not found');
    await this.db.query(`DELETE FROM user_role WHERE user_id = $1`, [id]);
    await this.assignRoles(orgId, id, dto.roleIds);
    return { ok: true };
  }

  async resetPassword(orgId: string, id: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    const u = (await this.db.query(`SELECT 1 FROM app_user WHERE id = $1 AND org_id = $2`, [id, orgId])) as unknown[];
    if (!u.length) throw new NotFoundException('User not found');
    await this.db.query(`UPDATE app_user SET password_hash = $1 WHERE id = $2`, [hash, id]);
    return { ok: true };
  }

  private async assignRoles(orgId: string, userId: string, roleIds: string[]) {
    for (const roleId of roleIds) {
      const r = (await this.db.query(`SELECT 1 FROM role WHERE id = $1 AND org_id = $2`, [roleId, orgId])) as unknown[];
      if (r.length) {
        await this.db.query(
          `INSERT INTO user_role (user_id, role_id, plant_id) VALUES ($1, $2, NULL) ON CONFLICT DO NOTHING`,
          [userId, roleId],
        );
      }
    }
  }

  // --- Roles & permissions -------------------------------------------------
  listRoles(orgId: string) {
    return this.db.query(
      `SELECT r.id, r.code, r.name,
              COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
         FROM role r
         LEFT JOIN role_permission rp ON rp.role_id = r.id
         LEFT JOIN permission p ON p.id = rp.permission_id
        WHERE r.org_id = $1
        GROUP BY r.id
        ORDER BY r.code`,
      [orgId],
    );
  }

  async createRole(orgId: string, dto: CreateRoleDto) {
    const exists = (await this.db.query(`SELECT 1 FROM role WHERE org_id = $1 AND code = $2`, [orgId, dto.code])) as unknown[];
    if (exists.length) throw new BadRequestException('A role with this code already exists');
    const rows = (await this.db.query(
      `INSERT INTO role (org_id, code, name) VALUES ($1, $2, $3) RETURNING id`,
      [orgId, dto.code, dto.name],
    )) as Array<{ id: string }>;
    return { id: rows[0].id };
  }

  async setRolePermissions(orgId: string, roleId: string, dto: SetPermissionsDto) {
    const r = (await this.db.query(`SELECT 1 FROM role WHERE id = $1 AND org_id = $2`, [roleId, orgId])) as unknown[];
    if (!r.length) throw new NotFoundException('Role not found');
    await this.db.query(`DELETE FROM role_permission WHERE role_id = $1`, [roleId]);
    if (dto.permissions.length) {
      await this.db.query(
        `INSERT INTO role_permission (role_id, permission_id)
         SELECT $1, p.id FROM permission p WHERE p.code = ANY($2) ON CONFLICT DO NOTHING`,
        [roleId, dto.permissions],
      );
    }
    return { ok: true };
  }

  async listPermissions(): Promise<string[]> {
    const rows = (await this.db.query(`SELECT code FROM permission ORDER BY code`)) as Array<{ code: string }>;
    return rows.map((r) => r.code);
  }
}
