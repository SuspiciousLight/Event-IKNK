import { Module } from '@nestjs/common';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { VkNotificationService } from './vk-notification.service';

@Module({
  providers: [NotificationDispatcherService, VkNotificationService],
  exports: [VkNotificationService],
})
export class NotificationsModule {}
