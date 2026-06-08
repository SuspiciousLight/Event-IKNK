import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

enum RegistrationStatusDto {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
}

export class UpdateRegistrationStatusDto {
  @IsEnum(RegistrationStatusDto)
  status!: RegistrationStatusDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
