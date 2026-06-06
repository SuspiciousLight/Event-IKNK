import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @Matches(/^\S{2,}\s+\S{2,}$/)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^@[A-Za-z0-9_]{5,32}$/)
  telegramUsername?: string;

  @IsOptional()
  @IsBoolean()
  disclaimerAccepted?: boolean;
}
