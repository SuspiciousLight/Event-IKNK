import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CampaignStatus,
  RecipientStatus,
  RegistrationStatus,
  ReminderStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VkNotificationService } from './vk-notification.service';

@Injectable()
export class NotificationDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly workerEnabled: boolean;
  private readonly intervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vkNotifications: VkNotificationService,
    configService: ConfigService,
  ) {
    this.workerEnabled = configService.get<string>('NOTIFICATION_WORKER_ENABLED', 'true') !== 'false';
    this.intervalMs = Number(configService.get<string>('NOTIFICATION_WORKER_INTERVAL_MS', '60000'));
  }

  onModuleInit(): void {
    if (!this.workerEnabled) {
      this.logger.log('Notification worker is disabled');
      return;
    }

    if (!this.vkNotifications.isReady()) {
      this.logger.warn('VK notifications are not configured. Reminder and campaign delivery will not run.');
      return;
    }

    void this.dispatchDueNotifications();
    this.timer = setInterval(() => {
      void this.dispatchDueNotifications();
    }, Math.max(this.intervalMs, 15000));
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async dispatchDueNotifications(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      await this.dispatchDueReminders();
      await this.dispatchQueuedCampaigns();
    } catch (error) {
      this.logger.error(`Notification worker failed: ${this.vkNotifications.toSafeError(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async dispatchDueReminders(): Promise<void> {
    const reminders = await this.prisma.reminder.findMany({
      where: {
        status: ReminderStatus.SCHEDULED,
        remindAt: { lte: new Date() },
        deletedAt: null,
        user: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
        event: {
          deletedAt: null,
        },
        OR: [
          { eventRegistrationId: null },
          {
            eventRegistration: {
              status: RegistrationStatus.ACTIVE,
              deletedAt: null,
            },
          },
        ],
      },
      orderBy: { remindAt: 'asc' },
      take: 25,
      select: {
        id: true,
        eventRegistrationId: true,
        user: { select: { vkUserId: true } },
        event: { select: { title: true, startAt: true } },
      },
    });

    for (const reminder of reminders) {
      try {
        const message = `Напоминание: «${reminder.event.title}» начнётся ${this.formatDateTime(reminder.event.startAt)}.`;
        const fragment = reminder.eventRegistrationId
          ? `#/reminder/${reminder.eventRegistrationId}`
          : '#/my-registrations';
        await this.vkNotifications.sendToUser(reminder.user.vkUserId, message, fragment);
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            status: ReminderStatus.SENT,
            sentAt: new Date(),
            errorMessage: null,
          },
        });
      } catch (error) {
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            status: ReminderStatus.FAILED,
            errorMessage: this.vkNotifications.toSafeError(error),
          },
        });
      }
    }
  }

  private async dispatchQueuedCampaigns(): Promise<void> {
    const campaigns = await this.prisma.notificationCampaign.findMany({
      where: {
        deletedAt: null,
        status: CampaignStatus.QUEUED,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        message: true,
        startedAt: true,
      },
    });

    for (const campaign of campaigns) {
      if (!campaign.startedAt) {
        await this.prisma.notificationCampaign.update({
          where: { id: campaign.id },
          data: { startedAt: new Date() },
        });
      }

      const recipients = await this.prisma.notificationRecipient.findMany({
        where: {
          campaignId: campaign.id,
          status: RecipientStatus.PENDING,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: {
          id: true,
          user: { select: { vkUserId: true, status: true, deletedAt: true } },
          eventRegistration: { select: { status: true, deletedAt: true } },
        },
      });

      for (const recipient of recipients) {
        if (
          recipient.user.status !== UserStatus.ACTIVE ||
          recipient.user.deletedAt ||
          recipient.eventRegistration?.status === RegistrationStatus.CANCELED ||
          recipient.eventRegistration?.deletedAt
        ) {
          await this.prisma.notificationRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientStatus.SKIPPED,
              errorMessage: 'Recipient is no longer eligible',
            },
          });
          continue;
        }

        try {
          await this.vkNotifications.sendToUser(
            recipient.user.vkUserId,
            `${campaign.title}. ${campaign.message}`,
            '#/my-registrations',
          );
          await this.prisma.notificationRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientStatus.SENT,
              sentAt: new Date(),
              errorMessage: null,
            },
          });
        } catch (error) {
          await this.prisma.notificationRecipient.update({
            where: { id: recipient.id },
            data: {
              status: RecipientStatus.FAILED,
              errorMessage: this.vkNotifications.toSafeError(error),
            },
          });
        }
      }

      await this.refreshCampaignStatus(campaign.id);
    }
  }

  private async refreshCampaignStatus(campaignId: string): Promise<void> {
    const [pendingCount, sentCount, failedCount] = await this.prisma.$transaction([
      this.prisma.notificationRecipient.count({
        where: { campaignId, status: RecipientStatus.PENDING },
      }),
      this.prisma.notificationRecipient.count({
        where: { campaignId, status: RecipientStatus.SENT },
      }),
      this.prisma.notificationRecipient.count({
        where: { campaignId, status: RecipientStatus.FAILED },
      }),
    ]);

    if (pendingCount > 0) {
      await this.prisma.notificationCampaign.update({
        where: { id: campaignId },
        data: {
          sentCount,
          failedCount,
        },
      });
      return;
    }

    await this.prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: {
        sentCount,
        failedCount,
        completedAt: new Date(),
        status: sentCount > 0 ? CampaignStatus.SENT : CampaignStatus.FAILED,
      },
    });
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  }
}
