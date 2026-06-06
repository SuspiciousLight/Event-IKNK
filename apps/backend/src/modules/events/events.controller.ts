import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { EventsQueryDto } from './dto/events-query.dto';
import { EventsService } from './events.service';

class EventIdParamDto {
  @IsUUID(4)
  eventId!: string;
}

@Controller('events')
@UseGuards(VkUserAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  listEvents(@CurrentUser() user: AuthenticatedUser, @Query() query: EventsQueryDto) {
    return this.eventsService.getEvents(query, user.userId);
  }

  @Get(':eventId')
  getEventCard(@CurrentUser() user: AuthenticatedUser, @Param() params: EventIdParamDto) {
    return this.eventsService.getEventCard(params.eventId, user.userId);
  }

  @Get(':eventId/waitlist')
  getWaitlistStatus(@CurrentUser() user: AuthenticatedUser, @Param() params: EventIdParamDto) {
    return this.eventsService.getWaitlistStatus(params.eventId, user.userId);
  }

  @Post(':eventId/waitlist')
  @RateLimit({ limit: 10, windowMs: 60 * 1000, keyPrefix: 'user-seat-waitlist-subscribe' })
  subscribeToWaitlist(@CurrentUser() user: AuthenticatedUser, @Param() params: EventIdParamDto) {
    return this.eventsService.subscribeToSeatWaitlist(params.eventId, user.userId);
  }

  @Delete(':eventId/waitlist')
  @RateLimit({ limit: 10, windowMs: 60 * 1000, keyPrefix: 'user-seat-waitlist-cancel' })
  cancelWaitlist(@CurrentUser() user: AuthenticatedUser, @Param() params: EventIdParamDto) {
    return this.eventsService.cancelSeatWaitlist(params.eventId, user.userId);
  }
}
