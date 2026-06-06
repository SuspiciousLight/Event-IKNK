import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ExportRegistrationsQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeCanceled?: boolean;
}
