import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { PROJECT_STATUSES, ProjectStatus } from '../../../common/enums';

export class CreateProjectDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @Length(1, 200)
  name: string;

  /** Optional — auto-allocated (PRJ-...) when omitted. */
  @IsOptional()
  @IsString()
  @Length(1, 24)
  code?: string;

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

/** Bulk create — add several projects in one call. */
export class BulkCreateProjectsDto {
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateProjectDto)
  projects: CreateProjectDto[];
}
