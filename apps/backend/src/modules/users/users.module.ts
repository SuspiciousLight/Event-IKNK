import { Module } from '@nestjs/common';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [UsersService, VkUserAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
