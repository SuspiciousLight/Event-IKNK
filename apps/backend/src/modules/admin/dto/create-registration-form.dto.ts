import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { CreateAdminFormQuestionDto } from './create-admin-form-question.dto';

enum FormStatusDto {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export class CreateRegistrationFormDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsEnum(FormStatusDto)
  status?: FormStatusDto;

  @IsOptional()
  @IsUUID(4)
  sourceTemplateId?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateAdminFormQuestionDto)
  questions!: CreateAdminFormQuestionDto[];
}
