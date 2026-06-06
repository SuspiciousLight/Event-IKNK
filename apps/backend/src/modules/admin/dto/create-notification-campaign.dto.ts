import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

enum CampaignStatusDto {
  DRAFT = 'DRAFT',
  QUEUED = 'QUEUED',
}

export class CreateNotificationCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsEnum(CampaignStatusDto)
  status?: CampaignStatusDto;
}
