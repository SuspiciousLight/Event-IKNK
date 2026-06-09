import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConsentType,
  EventStatus,
  FormStatus,
  Prisma,
  QuestionType,
  RegistrationStatus,
  ReminderStatus,
  SeatWaitlistStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CURRENT_PERSONAL_DATA_CONSENT } from '../consents/current-consent';
import { CancelRegistrationDto } from './dto/cancel-registration.dto';
import {
  CreateRegistrationDto,
  RegistrationAnswerInputDto,
  RegistrationConsentInputDto,
} from './dto/create-registration.dto';
import { MyRegistrationsQueryDto, MyRegistrationsScopeDto } from './dto/my-registrations-query.dto';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listMyRegistrations(userId: string, query: MyRegistrationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = query.scope ?? MyRegistrationsScopeDto.ACTIVE;
    const now = new Date();

    const where: Prisma.EventRegistrationWhereInput = {
      userId,
      deletedAt: null,
      ...(query.status ? { status: query.status as RegistrationStatus } : {}),
    };

    if (scope === MyRegistrationsScopeDto.ACTIVE) {
      where.status = RegistrationStatus.ACTIVE;
      where.event = {
        deletedAt: null,
        status: EventStatus.PUBLISHED,
        endAt: { gte: now },
      };
    }

    if (scope === MyRegistrationsScopeDto.ARCHIVE) {
      where.OR = [
        { status: RegistrationStatus.CANCELED },
        { event: { deletedAt: { not: null } } },
        { event: { status: { not: EventStatus.PUBLISHED } } },
        { event: { endAt: { lt: now } } },
      ];
    }

    const orderBy: Prisma.EventRegistrationOrderByWithRelationInput[] =
      scope === MyRegistrationsScopeDto.ACTIVE
        ? [{ event: { startAt: 'asc' } }, { registeredAt: 'desc' }]
        : [{ event: { startAt: 'desc' } }, { registeredAt: 'desc' }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.eventRegistration.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          eventId: true,
          status: true,
          registeredAt: true,
          canceledAt: true,
          cancelReason: true,
          event: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              location: true,
              status: true,
            },
          },
          reminders: {
            where: {
              deletedAt: null,
              status: ReminderStatus.SCHEDULED,
            },
            orderBy: { remindAt: 'asc' },
            take: 1,
            select: {
              id: true,
              remindAt: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.eventRegistration.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        eventId: item.eventId,
        status: item.status,
        registeredAt: item.registeredAt,
        canceledAt: item.canceledAt,
        cancelReason: item.cancelReason,
        event: item.event,
        isEventFinished: item.event ? item.event.endAt < now : false,
        activeReminder: item.reminders[0] ?? null,
      })),
      meta: { page, pageSize, total },
    };
  }

  async createRegistration(userId: string, dto: CreateRegistrationDto) {
    this.validateRegistrationConsent(dto.consent);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, vkUserId: true, status: true, deletedAt: true, profile: true },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new NotFoundException('User not found');
    }

    if (!user.profile || user.profile.deletedAt || !user.profile.isActive) {
      throw new BadRequestException({
        code: 'PROFILE_REQUIRED',
        message: 'Active profile is required before registration',
      });
    }

    if (!user.vkUserId || !user.profile.fullName) {
      throw new BadRequestException({
        code: 'PROFILE_FIELDS_REQUIRED',
        message: 'Profile should include VK ID, surname and first name before registration',
      });
    }

    const event = await this.prisma.event.findFirst({
      where: {
        id: dto.eventId,
        status: EventStatus.PUBLISHED,
        deletedAt: null,
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        capacity: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Registration closes once the event has started.
    if (event.startAt <= new Date()) {
      throw new BadRequestException({
        code: 'REGISTRATION_CLOSED',
        message: 'Registration is closed: event already started',
      });
    }

    // A registration form is optional: the admin only attaches one when the event
    // needs extra data beyond the profile. The active form is resolved on the
    // server so the client cannot bypass a required form by omitting its id.
    const form = await this.prisma.registrationForm.findFirst({
      where: {
        eventId: dto.eventId,
        status: FormStatus.PUBLISHED,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      include: {
        questions: {
          orderBy: { position: 'asc' },
        },
      },
    });

    await this.ensureNoActiveDuplicate(this.prisma, dto.eventId, userId);

    const validatedAnswers = form
      ? this.validateAndNormalizeAnswers(form.questions, dto.answers ?? [])
      : [];

    let transactionResult;
    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        if (event.capacity !== null) {
          await this.lockEventCapacity(tx, dto.eventId);
        }

        await this.ensureNoActiveDuplicate(tx, dto.eventId, userId);
        await this.ensureCapacityAvailable(tx, dto.eventId, event.capacity);

        const created = await tx.eventRegistration.create({
          data: {
            eventId: dto.eventId,
            userId,
            userProfileId: user.profile!.id,
            registrationFormId: form?.id ?? null,
            status: RegistrationStatus.ACTIVE,
            activeMarker: 1,
          },
        });

        await tx.seatWaitlistSubscription.updateMany({
          where: {
            eventId: dto.eventId,
            userId,
            status: SeatWaitlistStatus.ACTIVE,
            activeMarker: 1,
            deletedAt: null,
          },
          data: {
            status: SeatWaitlistStatus.CANCELED,
            activeMarker: null,
            canceledAt: new Date(),
          },
        });

        if (validatedAnswers.length > 0) {
          await tx.registrationAnswer.createMany({
            data: validatedAnswers.map((answer) => ({
              eventRegistrationId: created.id,
              formQuestionId: answer.formQuestionId,
              questionKey: answer.questionKey,
              questionLabel: answer.questionLabel,
              answerText: answer.answerText,
              ...(answer.answerJson !== undefined ? { answerJson: answer.answerJson } : {}),
            })),
          });
        }

        const consent = await tx.consent.create({
          data: {
            userId,
            eventId: dto.eventId,
            eventRegistrationId: created.id,
            consentType: ConsentType.PERSONAL_DATA_PROCESSING,
            consentVersion: dto.consent.version,
            consentTextHash: dto.consent.textHash,
            contextKey: created.id,
          },
          select: {
            id: true,
            consentVersion: true,
            consentTextHash: true,
            acceptedAt: true,
          },
        });

        return { registration: created, consent };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'ACTIVE_REGISTRATION_EXISTS',
          message: 'Active registration already exists for this event',
        });
      }

      throw error;
    }

    const { registration, consent } = transactionResult;

    await this.auditService.log({
      actorId: userId,
      actorRole: 'USER',
      action: 'REGISTRATION_CREATED',
      targetType: 'event_registration',
      targetId: registration.id,
      metadata: {
        eventId: dto.eventId,
        registrationFormId: form?.id ?? null,
        answersCount: validatedAnswers.length,
        consentId: consent.id,
      },
    });

    return {
      id: registration.id,
      eventId: registration.eventId,
      status: registration.status,
      registeredAt: registration.registeredAt,
      profileUsed: {
        id: user.profile.id,
        fullName: user.profile.fullName,
      },
      consent: {
        version: consent.consentVersion,
        textHash: consent.consentTextHash,
        acceptedAt: consent.acceptedAt,
      },
    };
  }

  async cancelRegistration(userId: string, registrationId: string, dto: CancelRegistrationDto) {
    const registration = await this.prisma.eventRegistration.findFirst({
      where: {
        id: registrationId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        eventId: true,
        status: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.status === RegistrationStatus.CANCELED) {
      throw new ConflictException({
        code: 'REGISTRATION_ALREADY_CANCELED',
        message: 'Registration already canceled',
      });
    }

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const result = await tx.eventRegistration.update({
        where: { id: registrationId },
        data: {
          status: RegistrationStatus.CANCELED,
          canceledAt: new Date(),
          canceledByUserId: userId,
          cancelReason: dto.reason || null,
          activeMarker: null,
        },
        select: {
          id: true,
          eventId: true,
          status: true,
          canceledAt: true,
          cancelReason: true,
        },
      });

      await tx.reminder.updateMany({
        where: {
          userId,
          eventRegistrationId: registrationId,
          status: ReminderStatus.SCHEDULED,
          deletedAt: null,
        },
        data: {
          status: ReminderStatus.CANCELED,
          canceledAt: new Date(),
        },
      });

      const notifiedWaitlistId = await this.markNextWaitlistCandidateIfSeatAvailable(tx, registration.eventId);

      return {
        registration: result,
        notifiedWaitlistId,
      };
    });

    await this.auditService.log({
      actorId: userId,
      actorRole: 'USER',
      action: 'REGISTRATION_CANCELED',
      targetType: 'event_registration',
      targetId: registrationId,
      metadata: {
        eventId: registration.eventId,
        hasReason: !!dto.reason,
        reasonLength: dto.reason?.length || 0,
        notifiedWaitlistId: transactionResult.notifiedWaitlistId,
      },
    });

    return transactionResult.registration;
  }

  async resumeRegistration(userId: string, registrationId: string) {
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const registration = await tx.eventRegistration.findFirst({
        where: {
          id: registrationId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          eventId: true,
          userId: true,
          status: true,
          event: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              location: true,
              capacity: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found');
      }

      if (registration.status !== RegistrationStatus.CANCELED) {
        throw new ConflictException({
          code: 'REGISTRATION_NOT_CANCELED',
          message: 'Only canceled registrations can be resumed',
        });
      }

      if (
        registration.event.deletedAt ||
        registration.event.status !== EventStatus.PUBLISHED ||
        registration.event.startAt <= now
      ) {
        throw new BadRequestException({
          code: 'REGISTRATION_RESUME_CLOSED',
          message: 'Registration cannot be resumed for inactive or already started event',
        });
      }

      if (registration.event.capacity !== null) {
        await this.lockEventCapacity(tx, registration.eventId);
      }

      await this.ensureNoActiveDuplicate(tx, registration.eventId, userId);
      await this.ensureCapacityAvailable(tx, registration.eventId, registration.event.capacity);

      await tx.seatWaitlistSubscription.updateMany({
        where: {
          eventId: registration.eventId,
          userId,
          status: SeatWaitlistStatus.ACTIVE,
          activeMarker: 1,
          deletedAt: null,
        },
        data: {
          status: SeatWaitlistStatus.CANCELED,
          activeMarker: null,
          canceledAt: now,
        },
      });

      return tx.eventRegistration.update({
        where: { id: registrationId },
        data: {
          status: RegistrationStatus.ACTIVE,
          activeMarker: 1,
          canceledAt: null,
          canceledByUserId: null,
          cancelReason: null,
        },
        select: {
          id: true,
          eventId: true,
          status: true,
          registeredAt: true,
          canceledAt: true,
          cancelReason: true,
          event: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              location: true,
              status: true,
            },
          },
          reminders: {
            where: {
              deletedAt: null,
              status: ReminderStatus.SCHEDULED,
            },
            orderBy: { remindAt: 'asc' },
            take: 1,
            select: {
              id: true,
              remindAt: true,
              status: true,
            },
          },
        },
      });
    });

    await this.auditService.log({
      actorId: userId,
      actorRole: 'USER',
      action: 'REGISTRATION_RESUMED',
      targetType: 'event_registration',
      targetId: registrationId,
      metadata: {
        eventId: updated.eventId,
      },
    });

    return {
      id: updated.id,
      eventId: updated.eventId,
      status: updated.status,
      registeredAt: updated.registeredAt,
      canceledAt: updated.canceledAt,
      cancelReason: updated.cancelReason,
      event: updated.event,
      isEventFinished: updated.event ? updated.event.endAt < now : false,
      activeReminder: updated.reminders[0] ?? null,
    };
  }

  private async markNextWaitlistCandidateIfSeatAvailable(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<string | null> {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { capacity: true },
    });

    if (!event || event.capacity === null) {
      return null;
    }

    const activeCount = await tx.eventRegistration.count({
      where: {
        eventId,
        status: RegistrationStatus.ACTIVE,
        activeMarker: 1,
        deletedAt: null,
      },
    });

    if (activeCount >= event.capacity) {
      return null;
    }

    const next = await tx.seatWaitlistSubscription.findFirst({
      where: {
        eventId,
        status: SeatWaitlistStatus.ACTIVE,
        activeMarker: 1,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!next) {
      return null;
    }

    await tx.seatWaitlistSubscription.update({
      where: { id: next.id },
      data: {
        status: SeatWaitlistStatus.NOTIFIED,
        activeMarker: null,
        notifiedAt: new Date(),
      },
    });

    return next.id;
  }

  private validateRegistrationConsent(consent: RegistrationConsentInputDto | undefined): void {
    if (!consent?.accepted) {
      throw new BadRequestException({
        code: 'CONSENT_REQUIRED',
        message: 'Personal data processing consent is required before registration',
      });
    }

    if (
      consent.version !== CURRENT_PERSONAL_DATA_CONSENT.version ||
      consent.textHash !== CURRENT_PERSONAL_DATA_CONSENT.textHash
    ) {
      throw new BadRequestException({
        code: 'CONSENT_VERSION_MISMATCH',
        message: 'Consent metadata does not match the current personal data consent',
      });
    }
  }

  private async ensureNoActiveDuplicate(
    client: Prisma.TransactionClient | PrismaService,
    eventId: string,
    userId: string,
  ): Promise<void> {
    const existing = await client.eventRegistration.findFirst({
      where: {
        eventId,
        userId,
        status: RegistrationStatus.ACTIVE,
        activeMarker: 1,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'ACTIVE_REGISTRATION_EXISTS',
        message: 'Active registration already exists for this event',
      });
    }
  }

  private async ensureCapacityAvailable(
    tx: Prisma.TransactionClient,
    eventId: string,
    capacity: number | null,
  ): Promise<void> {
    if (capacity === null) {
      return;
    }

    const activeCount = await tx.eventRegistration.count({
      where: {
        eventId,
        status: RegistrationStatus.ACTIVE,
        activeMarker: 1,
        deletedAt: null,
      },
    });

    if (activeCount >= capacity) {
      throw new ConflictException({
        code: 'EVENT_CAPACITY_REACHED',
        message: 'No available places left for this event',
      });
    }
  }

  private async lockEventCapacity(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
    // $executeRaw is used (not $queryRaw): pg_advisory_xact_lock returns `void`,
    // which $queryRaw cannot deserialize. executeRaw just runs the statement.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
  }

  private validateAndNormalizeAnswers(
    questions: Array<{
      id: string;
      fieldKey: string;
      label: string;
      questionType: QuestionType;
      isRequired: boolean;
      options: Prisma.JsonValue | null;
    }>,
    answers: RegistrationAnswerInputDto[],
    ): Array<{
      formQuestionId: string;
      questionKey: string;
      questionLabel: string;
      answerText: string | null;
      answerJson?: Prisma.InputJsonValue;
    }> {
    const answersByKey = new Map<string, RegistrationAnswerInputDto>();

    for (const answer of answers) {
      if (answersByKey.has(answer.questionKey)) {
        throw new BadRequestException({
          code: 'DUPLICATE_ANSWER_KEY',
          message: `Duplicate answer for question ${answer.questionKey}`,
        });
      }

      answersByKey.set(answer.questionKey, answer);
    }

    for (const key of answersByKey.keys()) {
      const known = questions.some((question) => question.fieldKey === key);
      if (!known) {
        throw new BadRequestException({
          code: 'UNKNOWN_QUESTION_KEY',
          message: `Unknown question key: ${key}`,
        });
      }
    }

    const normalized = questions.map((question) => {
      const input = answersByKey.get(question.fieldKey);
      const rawText = input?.answerText?.trim();
      const hasText = !!rawText;
      const hasJson = input?.answerJson !== undefined;

      if (question.isRequired && !hasText && !hasJson) {
        throw new BadRequestException({
          code: 'REQUIRED_ANSWER_MISSING',
          message: `Answer is required for question ${question.fieldKey}`,
        });
      }

      if (input) {
        this.validateSingleAnswer(question.questionType, rawText, input.answerJson, question.options);
      }

      return {
        formQuestionId: question.id,
        questionKey: question.fieldKey,
        questionLabel: question.label,
        answerText: hasText ? rawText! : null,
        answerJson: this.toInputJson(input?.answerJson),
      };
    });

    return normalized.filter((answer) => answer.answerText !== null || answer.answerJson !== undefined);
  }

  private validateSingleAnswer(
    questionType: QuestionType,
    answerText: string | undefined,
    answerJson: Record<string, unknown> | undefined,
    options: Prisma.JsonValue | null,
  ): void {
    if (!answerText && answerJson === undefined) {
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\-\s()]{7,20}$/;

    switch (questionType) {
      case QuestionType.EMAIL:
        if (!answerText || !emailRegex.test(answerText)) {
          throw new BadRequestException({ code: 'INVALID_EMAIL', message: 'Invalid email answer format' });
        }
        break;
      case QuestionType.PHONE:
        if (!answerText || !phoneRegex.test(answerText)) {
          throw new BadRequestException({ code: 'INVALID_PHONE', message: 'Invalid phone answer format' });
        }
        break;
      case QuestionType.NUMBER:
        if (!answerText || Number.isNaN(Number(answerText))) {
          throw new BadRequestException({ code: 'INVALID_NUMBER', message: 'Invalid numeric answer format' });
        }
        break;
      case QuestionType.DATE:
        if (!answerText || Number.isNaN(Date.parse(answerText))) {
          throw new BadRequestException({ code: 'INVALID_DATE', message: 'Invalid date answer format' });
        }
        break;
      case QuestionType.SELECT:
      case QuestionType.COURSE:
        if (!answerText) {
          throw new BadRequestException({ code: 'INVALID_SELECT', message: 'Select answer must be text value' });
        }
        if (Array.isArray(options) && options.length > 0) {
          const allowed = options.filter((item) => typeof item === 'string') as string[];
          if (allowed.length > 0 && !allowed.includes(answerText)) {
            throw new BadRequestException({ code: 'INVALID_SELECT_OPTION', message: 'Selected option is not allowed' });
          }
        }
        break;
      case QuestionType.CHECKBOX:
        if (answerJson === undefined) {
          throw new BadRequestException({
            code: 'INVALID_CHECKBOX',
            message: 'Checkbox answer must be json payload',
          });
        }
        break;
      default:
        if (!answerText && answerJson === undefined) {
          throw new BadRequestException({
            code: 'INVALID_ANSWER',
            message: 'Answer should include text or json payload',
          });
        }
    }
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.toInputJson(item))
        .filter((item): item is Prisma.InputJsonValue => item !== undefined);
    }

    if (typeof value === 'object') {
      const result: Record<string, Prisma.InputJsonValue> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        const parsed = this.toInputJson(nested);
        if (parsed !== undefined) {
          result[key] = parsed;
        }
      }
      return result;
    }

    return undefined;
  }
}
