import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class AcceptConsentDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[0-9A-Za-z._-]+$/)
  consentVersion!: string;

  @IsString()
  @MaxLength(128)
  @Matches(/^sha256:[a-f0-9]{64}$/i)
  consentTextHash!: string;

  @IsOptional()
  @IsUUID(4)
  eventId?: string;

  @IsOptional()
  @IsUUID(4)
  eventRegistrationId?: string;
}
