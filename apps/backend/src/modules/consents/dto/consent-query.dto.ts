import { IsOptional, IsUUID } from 'class-validator';

export class ConsentQueryDto {
  @IsOptional()
  @IsUUID(4)
  eventId?: string;

  @IsOptional()
  @IsUUID(4)
  eventRegistrationId?: string;
}