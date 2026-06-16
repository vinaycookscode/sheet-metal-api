import { IsDateString, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PROJECT_STATUSES, ProjectStatus } from '../../../common/enums';

/** Customer and code are immutable once set; only these are editable. */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

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
