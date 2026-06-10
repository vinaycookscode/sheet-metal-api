import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  fullName: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsUUID()
  defaultPlantId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  roleIds?: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  defaultPlantId?: string;
}

export class SetRolesDto {
  @IsArray()
  @IsUUID('all', { each: true })
  roleIds: string[];
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}

export class CreateRoleDto {
  @IsString()
  code: string;

  @IsString()
  name: string;
}

export class SetPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
