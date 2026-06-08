import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CURRENT_PROFILE_DISCLAIMER } from './current-profile-disclaimer';
import { UpdateProfileDto } from './dto/update-profile.dto';

type ProfileRecord = {
  id: string;
  userId: string;
  fullName: string;
  telegramUsername: string | null;
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
    const telegramUsername = dto.telegramUsername?.trim();

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
    const nextTelegramUsername = telegramUsername ?? existing?.telegramUsername ?? null;
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
          telegramUsername: nextTelegramUsername || null,
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
        ...(telegramUsername !== undefined ? { telegramUsername } : {}),
        ...disclaimerData,
      },
      select: this.profileSelect(),
    });

    await this.auditProfileChange(userId, updated.id, dto);
    return this.toProfileDto(updated);
  }

  private profileSelect() {
    return {
      id: true,
      userId: true,
      fullName: true,
      telegramUsername: true,
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
      telegramUsername: profile.telegramUsername,
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
