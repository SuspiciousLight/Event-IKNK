import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { SetReminderDto } from './dto/set-reminder.dto';
import { RemindersService } from './reminders.service';

class RegistrationIdParamDto {
  @IsUUID(4)
  registrationId!: string;
}

@Controller('reminders')
@UseGuards(VkUserAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('registrations/:registrationId')
  getReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: RegistrationIdParamDto,
  ) {
    return this.remindersService.getReminder(user.userId, params.registrationId);
  }

  @Post('registrations/:registrationId')
  @RateLimit({ limit: 30, windowMs: 60 * 1000, keyPrefix: 'user-set-reminder' })
  setReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: RegistrationIdParamDto,
    @Body() dto: SetReminderDto,
  ) {
    return this.remindersService.setReminder(user.userId, params.registrationId, dto);
  }

  @Patch('registrations/:registrationId/cancel')
  @RateLimit({ limit: 30, windowMs: 60 * 1000, keyPrefix: 'user-cancel-reminder' })
  cancelReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: RegistrationIdParamDto,
  ) {
    return this.remindersService.cancelReminder(user.userId, params.registrationId);
  }
}
