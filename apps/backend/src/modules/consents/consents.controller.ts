import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AcceptConsentDto } from './dto/accept-consent.dto';
import { ConsentQueryDto } from './dto/consent-query.dto';
import { ConsentsService } from './consents.service';

@Controller('consents')
@UseGuards(VkUserAuthGuard)
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Post()
  @RateLimit({ limit: 20, windowMs: 60 * 1000, keyPrefix: 'user-accept-consent' })
  acceptConsent(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcceptConsentDto) {
    return this.consentsService.acceptConsent(user.userId, dto);
  }

  @Get('current')
  getCurrentConsent() {
    return this.consentsService.getCurrentConsent();
  }

  @Get('me')
  getMyConsents(@CurrentUser() user: AuthenticatedUser, @Query() query: ConsentQueryDto) {
    return this.consentsService.getMyConsents(user.userId, query);
  }
}
