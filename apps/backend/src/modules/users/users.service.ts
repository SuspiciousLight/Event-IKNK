import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReminderStatus, RegistrationStatus, SeatWaitlistStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CURRENT_PROFILE_DISCLAIMER } from './current-profile-disclaimer';
import { UpdateProfileDto } from './dto/update-profile.dto';

type ProfileRecord = {
  id: string;
  userId: string;
  fullName: string;
  disclaimerAccepted: boolean;
  disclaimerAcceptedAt: Date | null;
  disclaimerVersion: string | null;
  isActive: boolean;
  deactivatedAt: Date | null;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getProfileDisclaimer() {
    return CURRENT_PROFILE_DISCLAIMER;
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.userProfile.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      select: this.profileSelect(),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.toProfileDto(profile);
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    const fullName = dto.fullName?.trim().replace(/\s+/g, ' ');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, vkUserId: true, status: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    if (!user.vkUserId) {
      throw new BadRequestException({
        code: 'VK_ID_REQUIRED',
        message: 'VK ID is required to create or update profile',
      });
    }

    const existing = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: this.profileSelect(),
    });

    const nextFullName = fullName ?? existing?.fullName;
    const hasCurrentDisclaimer =
      existing?.disclaimerAccepted === true &&
      existing.disclaimerVersion === CURRENT_PROFILE_DISCLAIMER.version;

    if (!nextFullName) {
      throw new BadRequestException({
        code: 'PROFILE_FIELDS_REQUIRED',
        message: 'Surname and first name are required for profile',
      });
    }

    if (!hasCurrentDisclaimer && dto.disclaimerAccepted !== true) {
      throw new BadRequestException({
        code: 'PROFILE_DISCLAIMER_REQUIRED',
        message: 'Profile disclaimer must be explicitly accepted before saving profile',
      });
    }

    const disclaimerData = dto.disclaimerAccepted === true
      ? {
          disclaimerAccepted: true,
          disclaimerAcceptedAt: new Date(),
          disclaimerVersion: CURRENT_PROFILE_DISCLAIMER.version,
        }
      : {};

    if (!existing) {
      const created = await this.prisma.userProfile.create({
        data: {
          userId,
          fullName: nextFullName,
          ...disclaimerData,
        },
        select: this.profileSelect(),
      });

      await this.auditProfileChange(userId, created.id, dto);
      return this.toProfileDto(created);
    }

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        ...(fullName !== undefined ? { fullName } : {}),
        ...disclaimerData,
      },
      select: this.profileSelect(),
    });

    await this.auditProfileChange(userId, updated.id, dto);
    return this.toProfileDto(updated);
  }

  async deactivateMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        profile: {
          select: {
            id: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    const deactivatedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.eventRegistration.updateMany({
        where: {
          userId,
          status: RegistrationStatus.ACTIVE,
          deletedAt: null,
        },
        data: {
          status: RegistrationStatus.CANCELED,
          activeMarker: null,
          canceledAt: deactivatedAt,
          canceledByUserId: userId,
          cancelReason: 'Profile deactivated by user',
        },
      });

      await tx.reminder.updateMany({
        where: {
          userId,
          status: ReminderStatus.SCHEDULED,
          deletedAt: null,
        },
        data: {
          status: ReminderStatus.CANCELED,
          canceledAt: deactivatedAt,
        },
      });

      await tx.registrationAnswer.updateMany({
        where: {
          eventRegistration: {
            userId,
          },
        },
        data: {
          answerText: null,
          answerJson: Prisma.DbNull,
        },
      });

      await tx.seatWaitlistSubscription.updateMany({
        where: {
          userId,
          status: SeatWaitlistStatus.ACTIVE,
          deletedAt: null,
        },
        data: {
          status: SeatWaitlistStatus.CANCELED,
          activeMarker: null,
          canceledAt: deactivatedAt,
          deletedAt: deactivatedAt,
        },
      });

      await tx.userProfile.updateMany({
        where: {
          userId,
          deletedAt: null,
        },
        data: {
          fullName: 'Удаленный пользователь',
          telegramUsername: null,
          isActive: false,
          deactivatedAt,
          deletedAt: deactivatedAt,
        },
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DEACTIVATED,
          vkUserId: null,
          deletedAt: deactivatedAt,
        },
        select: {
          id: true,
          status: true,
          deletedAt: true,
        },
      });
    });

    await this.auditService.log({
      actorId: userId,
      actorRole: 'USER',
      action: 'PROFILE_DEACTIVATED',
      targetType: 'user',
      targetId: userId,
      metadata: {
        activeRecordsCanceled: true,
      },
    });

    return {
      success: true,
      deactivatedAt: result.deletedAt ?? deactivatedAt,
    };
  }

  private profileSelect() {
    return {
      id: true,
      userId: true,
      fullName: true,
      disclaimerAccepted: true,
      disclaimerAcceptedAt: true,
      disclaimerVersion: true,
      isActive: true,
      deactivatedAt: true,
      updatedAt: true,
    } as const;
  }

  private toProfileDto(profile: ProfileRecord) {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      disclaimerAccepted: profile.disclaimerAccepted,
      disclaimerAcceptedAt: profile.disclaimerAcceptedAt,
      disclaimerVersion: profile.disclaimerVersion,
      currentDisclaimerVersion: CURRENT_PROFILE_DISCLAIMER.version,
      isActive: profile.isActive,
      deactivatedAt: profile.deactivatedAt,
      updatedAt: profile.updatedAt,
    };
  }

  private async auditProfileChange(userId: string, profileId: string, dto: UpdateProfileDto): Promise<void> {
    await this.auditService.log({
      actorId: userId,
      actorRole: 'USER',
      action: 'PROFILE_UPDATED',
      targetType: 'user_profile',
      targetId: profileId,
      metadata: {
        fieldsUpdated: Object.keys(dto),
        disclaimerVersion: dto.disclaimerAccepted ? CURRENT_PROFILE_DISCLAIMER.version : undefined,
      },
    });
  }
}
