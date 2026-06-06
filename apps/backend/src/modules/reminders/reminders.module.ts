import { Module } from '@nestjs/common';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [AuditModule],
  controllers: [RemindersController],
  providers: [RemindersService, VkUserAuthGuard],
  exports: [RemindersService],
})
export class RemindersModule {}
