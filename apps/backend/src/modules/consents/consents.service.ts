import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConsentType, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CURRENT_PERSONAL_DATA_CONSENT } from './current-consent';
import { AcceptConsentDto } from './dto/accept-consent.dto';
import { ConsentQueryDto } from './dto/consent-query.dto';

@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getCurrentConsent() {
    return CURRENT_PERSONAL_DATA_CONSENT;
  }

  async acceptConsent(userId: string, dto: AcceptConsentDto) {
    this.ensureCurrentConsentMetadata(dto.consentVersion, dto.consentTextHash);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    if (dto.eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: dto.eventId, deletedAt: null },
        select: { id: true },
      });

      if (!event) {
        throw new NotFoundException('Event not found');
      }
    }

    if (dto.eventRegistrationId) {
      const registration = await this.prisma.eventRegistration.findFirst({
        where: {
          id: dto.eventRegistrationId,
          userId,
          deletedAt: null,
        },
        select: { id: true, eventId: true },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found');
      }

      if (dto.eventId && registration.eventId !== dto.eventId) {
        throw new BadRequestException({
          code: 'CONSENT_EVENT_MISMATCH',
          message: 'eventId does not match provided eventRegistrationId',
        });
      }
    }

    const contextKey = dto.eventRegistrationId || dto.eventId || 'GLOBAL';

    const consent = await this.prisma.consent.upsert({
      where: {
        userId_consentType_consentVersion_contextKey: {
          userId,
          consentType: ConsentType.PERSONAL_DATA_PROCESSING,
          consentVersion: dto.consentVersion,
          contextKey,
        },
      },
      update: {
        acceptedAt: new Date(),
        consentTextHash: dto.consentTextHash,
        eventId: dto.eventId,
        eventRegistrationId: dto.eventRegistrationId,
      },
      create: {
        userId,
        eventId: dto.eventId,
        eventRegistrationId: dto.eventRegistrationId,
        consentType: ConsentType.PERSONAL_DATA_PROCESSING,
        consentVersion: dto.consentVersion,
        consentTextHash: dto.consentTextHash,
        contextKey,
      },
      select: {
        id: true,
        userId: true,
        eventId: true,
        eventRegistrationId: true,
        consentType: true,
        consentVersion: true,
        consentTextHash: true,
        contextKey: true,
        acceptedAt: true,
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorRole: 'USER',
      action: 'CONSENT_ACCEPTED',
      targetType: 'consent',
      targetId: consent.id,
      metadata: {
        eventId: consent.eventId,
        eventRegistrationId: consent.eventRegistrationId,
        consentVersion: consent.consentVersion,
        consentTextHash: consent.consentTextHash,
      },
    });

    return consent;
  }

  async getMyConsents(userId: string, query: ConsentQueryDto) {
    const where = {
      userId,
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(query.eventRegistrationId ? { eventRegistrationId: query.eventRegistrationId } : {}),
    };

    return this.prisma.consent.findMany({
      where,
      orderBy: { acceptedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        eventId: true,
        eventRegistrationId: true,
        consentType: true,
        consentVersion: true,
        consentTextHash: true,
        contextKey: true,
        acceptedAt: true,
      },
    });
  }

  private ensureCurrentConsentMetadata(consentVersion: string, consentTextHash: string): void {
    if (
      consentVersion !== CURRENT_PERSONAL_DATA_CONSENT.version ||
      consentTextHash !== CURRENT_PERSONAL_DATA_CONSENT.textHash
    ) {
      throw new BadRequestException({
        code: 'CONSENT_VERSION_MISMATCH',
        message: 'Consent metadata does not match the current personal data consent',
      });
    }
  }
}
