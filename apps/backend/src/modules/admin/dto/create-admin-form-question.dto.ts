import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

enum QuestionTypeDto {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  SELECT = 'SELECT',
  CHECKBOX = 'CHECKBOX',
  COURSE = 'COURSE',
  DATE = 'DATE',
  NUMBER = 'NUMBER',
}

export class CreateAdminFormQuestionDto {
  @IsInt()
  @Min(1)
  position!: number;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_]+$/)
  fieldKey!: string;

  @IsString()
  @MaxLength(255)
  label!: string;

  @IsEnum(QuestionTypeDto)
  questionType!: QuestionTypeDto;

  @IsBoolean()
  isRequired!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeholder?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  options?: string[];

  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;
}
