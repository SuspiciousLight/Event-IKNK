import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile-disclaimer')
  getProfileDisclaimer() {
    return this.usersService.getProfileDisclaimer();
  }

  @Get('me/profile')
  @UseGuards(VkUserAuthGuard)
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMyProfile(user.userId);
  }

  @Patch('me/profile')
  @UseGuards(VkUserAuthGuard)
  @RateLimit({ limit: 20, windowMs: 60 * 1000, keyPrefix: 'user-update-profile' })
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMyProfile(user.userId, dto);
  }
}
