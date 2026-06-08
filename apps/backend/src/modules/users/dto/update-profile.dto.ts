import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const FULL_NAME_REGEX = /^\p{L}[\p{L}'\u2019-]{1,63}\s+\p{L}[\p{L}'\u2019-]{1,63}$/u;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @Matches(FULL_NAME_REGEX, {
    message: 'fullName must contain surname and name; digits and service characters are not allowed',
  })
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
