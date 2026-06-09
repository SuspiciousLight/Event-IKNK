import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CancelRegistrationDto } from './dto/cancel-registration.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { MyRegistrationsQueryDto } from './dto/my-registrations-query.dto';
import { RegistrationsService } from './registrations.service';

class RegistrationIdParamDto {
  @IsUUID(4)
  registrationId!: string;
}

@Controller('registrations')
@UseGuards(VkUserAuthGuard)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get('me')
  listMyRegistrations(@CurrentUser() user: AuthenticatedUser, @Query() query: MyRegistrationsQueryDto) {
    return this.registrationsService.listMyRegistrations(user.userId, query);
  }

  @Post()
  @RateLimit({ limit: 10, windowMs: 60 * 1000, keyPrefix: 'user-create-registration' })
  createRegistration(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRegistrationDto) {
    return this.registrationsService.createRegistration(user.userId, dto);
  }

  @Patch(':registrationId/cancel')
  @RateLimit({ limit: 20, windowMs: 60 * 1000, keyPrefix: 'user-cancel-registration' })
  cancelRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: RegistrationIdParamDto,
    @Body() dto: CancelRegistrationDto,
  ) {
    return this.registrationsService.cancelRegistration(user.userId, params.registrationId, dto);
  }

  @Patch(':registrationId/resume')
  @RateLimit({ limit: 10, windowMs: 60 * 1000, keyPrefix: 'user-resume-registration' })
  resumeRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: RegistrationIdParamDto,
  ) {
    return this.registrationsService.resumeRegistration(user.userId, params.registrationId);
  }
}
