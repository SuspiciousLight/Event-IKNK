import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AdminService } from './admin.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateRegistrationFormDto } from './dto/create-registration-form.dto';
import { CreateFormTemplateAdminDto } from './dto/create-form-template-admin.dto';
import { CreateEventFromTemplateDto } from './dto/create-event-from-template.dto';
import { AdminRegistrationsQueryDto } from './dto/admin-registrations-query.dto';
import { ExportRegistrationsQueryDto } from './dto/export-registrations-query.dto';
import { CreateNotificationCampaignDto } from './dto/create-notification-campaign.dto';
import { AdminEventsQueryDto } from './dto/admin-events-query.dto';
import { AdminFormTemplatesQueryDto } from './dto/admin-form-templates-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('events')
  listEvents(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminEventsQueryDto) {
    return this.adminService.listEvents(user, query);
  }

  @Post('events')
  @RateLimit({ limit: 30, windowMs: 60 * 1000, keyPrefix: 'admin-create-event' })
  createEvent(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.adminService.createEvent(user, dto);
  }

  @Delete('events/:eventId')
  @RateLimit({ limit: 20, windowMs: 60 * 1000, keyPrefix: 'admin-delete-event' })
  deleteEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
  ) {
    return this.adminService.deleteEvent(user, eventId);
  }

  @Post('events/:eventId/forms')
  @RateLimit({ limit: 20, windowMs: 60 * 1000, keyPrefix: 'admin-create-form' })
  createRegistrationForm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: CreateRegistrationFormDto,
  ) {
    return this.adminService.createRegistrationForm(user, eventId, dto);
  }

  @Post('form-templates')
  @RateLimit({ limit: 20, windowMs: 60 * 1000, keyPrefix: 'admin-create-template' })
  createFormTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFormTemplateAdminDto) {
    return this.adminService.createFormTemplate(user, dto);
  }

  @Get('form-templates')
  listFormTemplates(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminFormTemplatesQueryDto) {
    return this.adminService.listFormTemplates(user, query);
  }

  @Post('events/from-template')
  @RateLimit({ limit: 20, windowMs: 60 * 1000, keyPrefix: 'admin-event-from-template' })
  createEventFromTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventFromTemplateDto) {
    return this.adminService.createEventFromTemplate(user, dto);
  }

  @Get('events/:eventId/registrations')
  getEventRegistrations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Query() query: AdminRegistrationsQueryDto,
  ) {
    return this.adminService.getEventRegistrations(user, eventId, query);
  }

  @Get('events/:eventId/registrations/excel')
  @RateLimit({ limit: 5, windowMs: 60 * 1000, keyPrefix: 'admin-export-excel' })
  async exportEventRegistrationsToExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Query() query: ExportRegistrationsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.adminService.exportEventRegistrationsToExcel(user, eventId, query);

    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);

    return new StreamableFile(result.buffer);
  }

  @Post('events/:eventId/campaigns')
  @RateLimit({ limit: 5, windowMs: 60 * 1000, keyPrefix: 'admin-create-campaign' })
  createNotificationCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: CreateNotificationCampaignDto,
  ) {
    return this.adminService.createNotificationCampaign(user, eventId, dto);
  }
}
