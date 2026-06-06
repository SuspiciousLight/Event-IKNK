import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

enum RegistrationStatusDto {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
}

enum RegistrationSortByDto {
  REGISTERED_AT = 'registeredAt',
  CANCELED_AT = 'canceledAt',
  FULL_NAME = 'fullName',
}

export class AdminRegistrationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RegistrationStatusDto)
  status?: RegistrationStatusDto;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(RegistrationSortByDto)
  sortBy?: RegistrationSortByDto;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeCanceled?: boolean;
}
