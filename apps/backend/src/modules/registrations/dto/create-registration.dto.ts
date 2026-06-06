import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ArrayMaxSize,
  Equals,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RegistrationAnswerInputDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_]+$/)
  questionKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  answerText?: string;

  @IsOptional()
  @IsObject()
  answerJson?: Record<string, unknown>;
}

export class RegistrationConsentInputDto {
  @IsDefined()
  @IsBoolean()
  @Equals(true)
  accepted!: boolean;

  @IsString()
  @MaxLength(64)
  @Matches(/^[0-9A-Za-z._-]+$/)
  version!: string;

  @IsString()
  @MaxLength(128)
  @Matches(/^sha256:[a-f0-9]{64}$/i)
  textHash!: string;
}

export class CreateRegistrationDto {
  @IsUUID(4)
  eventId!: string;

  @IsOptional()
  @IsUUID(4)
  registrationFormId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RegistrationAnswerInputDto)
  answers?: RegistrationAnswerInputDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => RegistrationConsentInputDto)
  consent!: RegistrationConsentInputDto;
}
