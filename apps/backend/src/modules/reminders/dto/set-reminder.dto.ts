import { IsISO8601 } from 'class-validator';

export class SetReminderDto {
  @IsISO8601()
  remindAt!: string;
}