import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

enum RegistrationStatusDto {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
}

export enum MyRegistrationsScopeDto {
  ACTIVE = 'active',
  ARCHIVE = 'archive',
  ALL = 'all',
}

export class MyRegistrationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RegistrationStatusDto)
  status?: RegistrationStatusDto;

  @IsOptional()
  @IsEnum(MyRegistrationsScopeDto)
  scope?: MyRegistrationsScopeDto;
}
