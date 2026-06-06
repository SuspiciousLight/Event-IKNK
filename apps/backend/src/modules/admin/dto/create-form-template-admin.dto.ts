import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CreateAdminFormQuestionDto } from './create-admin-form-question.dto';

export class CreateFormTemplateAdminDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/)
  @MaxLength(100)
  templateCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateAdminFormQuestionDto)
  questions!: CreateAdminFormQuestionDto[];
}
