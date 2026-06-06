import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegistrationStatus, ReminderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SetReminderDto } from './dto/set-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getReminder(userId: string, registrationId: string) {
    await this.ensureOwnRegistration(userId, registrationId);

    return this.prisma.reminder.findFirst({
      where: {
        userId,
        eventRegistrationId: registrationId,
        deletedAt: null,
        status: ReminderStatus.SCHEDULED,
      },
      orderBy: { remindAt: 'asc' },
      select: {
        id: true,
        userId: true,
        eventId: true,
        eventRegistrationId: true,
        remindAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async setReminder(userId: string, registrationId: string, dto: SetReminderDto) {
    const remindAt = new Date(dto.remindAt);
    if (Number.isNaN(remindAt.getTime())) {
      throw new BadRequestException({ code: 'INVALID_REMIND_AT', message: 'Invalid remindAt value' });
    }

    const registration = await this.prisma.eventRegistration.findFirst({
      where: {
        id: registrationId,
        userId,
        deletedAt: null,
      },
      include: {
        event: {
          select: {
            id: true,
            startAt: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.status !== RegistrationStatus.ACTIVE) {
      throw new ConflictException({
        code: 'REMINDER_FOR_CANCELED_REGISTRATION',
        message: 'Cannot set reminder for canceled registration',
      });
    }

    const now = new Date();
    if (remindAt <= now) {
      throw new BadRequestException({
        code: 'REMINDER_IN_PAST',
        message: 'Reminder time must be in the future',
      });
    }

    if (remindAt >= registration.event.startAt) {
      throw new BadRequestException({
        code: 'REMINDER_AFTER_EVENT_START',
        message: 'Reminder time must be before event start',
      });
    }

    const existing = await this.prisma.reminder.findFirst({
      where: {
        userId,
        eventRegistrationId: registrationId,
        deletedAt: null,
        status: ReminderStatus.SCHEDULED,
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await this.prisma.reminder.update({
        where: { id: existing.id },
        data: {
          remindAt,
          status: ReminderStatus.SCHEDULED,
          canceledAt: null,
          errorMessage: null,
        },
        select: {
          id: true,
          userId: true,
          eventId: true,
          eventRegistrationId: true,
          remindAt: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.auditReminder(userId, updated.id, 'REMINDER_UPDATED', registration.eventId, registrationId);
      return updated;
    }

    const created = await this.prisma.reminder.create({
      data: {
        userId,
        eventId: registration.eventId,
        eventRegistrationId: registrationId,
        remindAt,
        status: ReminderStatus.SCHEDULED,
      },
      select: {
        id: true,
        userId: true,
        eventId: true,
        eventRegistrationId: true,
        remindAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditReminder(userId, created.id, 'REMINDER_CREATED', registration.eventId, registrationId);
    return created;
  }

  async cancelReminder(userId: string, registrationId: string) {
    await this.ensureOwnRegistration(userId, registrationId);

    const reminder = await this.prisma.reminder.findFirst({
      where: {
        userId,
        eventRegistrationId: registrationId,
        deletedAt: null,
        status: ReminderStatus.SCHEDULED,
      },
      select: { id: true },
    });

    if (!reminder) {
      throw new NotFoundException('Scheduled reminder not found');
    }

    const canceled = await this.prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: ReminderStatus.CANCELED,
        canceledAt: new Date(),
      },
      select: {
        id: true,
        userId: true,
        eventId: true,
        eventRegistrationId: true,
        remindAt: true,
        status: true,
        canceledAt: true,
        updatedAt: true,
      },
    });

    await this.auditReminder(userId, canceled.id, 'REMINDER_CANCELED', canceled.eventId, registrationId);
    return canceled;
  }

  private async ensureOwnRegistration(userId: string, registrationId: string) {
    const registration = await this.prisma.eventRegistration.findFirst({
      where: {
        id: registrationId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
  }

  private async auditReminder(
    userId: string,
    reminderId: string,
    action: string,
    eventId: string,
    registrationId: string,
  ): Promise<void> {
    await this.auditService.log({
      actorId: userId,
      actorRole: 'USER',
      action,
      targetType: 'reminder',
      targetId: reminderId,
      metadata: {
        eventId,
        eventRegistrationId: registrationId,
      },
    });
  }
}
