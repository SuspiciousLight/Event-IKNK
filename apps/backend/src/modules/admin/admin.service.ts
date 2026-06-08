import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  EventStatus,
  FormStatus,
  Prisma,
  QuestionType,
  RegistrationStatus,
  RecipientStatus,
  ReminderStatus,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateRegistrationFormDto } from './dto/create-registration-form.dto';
import { CreateFormTemplateAdminDto } from './dto/create-form-template-admin.dto';
import { CreateEventFromTemplateDto } from './dto/create-event-from-template.dto';
import { AdminRegistrationsQueryDto } from './dto/admin-registrations-query.dto';
import { ExportRegistrationsQueryDto } from './dto/export-registrations-query.dto';
import { CreateNotificationCampaignDto } from './dto/create-notification-campaign.dto';
import { AdminEventsQueryDto } from './dto/admin-events-query.dto';
import { AdminFormTemplatesQueryDto } from './dto/admin-form-templates-query.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';

type AdminQuestionInput = {
  position: number;
  fieldKey: string;
  label: string;
  questionType: string;
  isRequired: boolean;
  placeholder?: string;
  options?: string[];
  validationRules?: Record<string, unknown>;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listEvents(actor: AuthenticatedUser, query: AdminEventsQueryDto) {
    await this.resolveAdmin(actor);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as EventStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: { startAt: query.sortOrder ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          startAt: true,
          endAt: true,
          location: true,
          capacity: true,
          status: true,
          _count: {
            select: {
              registrations: {
                where: {
                  status: RegistrationStatus.ACTIVE,
                  deletedAt: null,
                },
              },
              forms: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items, meta: { page, pageSize, total } };
  }

  async createEvent(actor: AuthenticatedUser, dto: CreateEventDto) {
    const admin = await this.resolveAdmin(actor);
    const { startAt, endAt } = this.validateEventDates(dto.startAt, dto.endAt);

    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        startAt,
        endAt,
        location: dto.location,
        capacity: dto.capacity,
        status: (dto.status as EventStatus | undefined) ?? EventStatus.DRAFT,
        createdByAdminId: admin.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        location: true,
        capacity: true,
        status: true,
      },
    });

    await this.logAdminAction(admin.userId, 'ADMIN_EVENT_CREATED', 'event', event.id, {
      status: event.status,
      capacityDefined: event.capacity !== null,
    });

    return event;
  }

  async deleteEvent(actor: AuthenticatedUser, eventId: string) {
    const admin = await this.resolveAdmin(actor);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        id: true,
        _count: {
          select: {
            registrations: { where: { status: RegistrationStatus.ACTIVE, deletedAt: null } },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const deletedAt = new Date();

    // Soft delete: hide the event and its forms from students and admin lists,
    // but keep registrations, consents and audit history intact.
    await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id: eventId },
        data: { deletedAt, status: EventStatus.ARCHIVED },
      }),
      this.prisma.registrationForm.updateMany({
        where: { eventId, deletedAt: null },
        data: { deletedAt },
      }),
    ]);

    await this.logAdminAction(admin.userId, 'ADMIN_EVENT_DELETED', 'event', eventId, {
      activeRegistrations: event._count.registrations,
    });

    return { id: eventId, deletedAt };
  }

  async createRegistrationForm(actor: AuthenticatedUser, eventId: string, dto: CreateRegistrationFormDto) {
    const admin = await this.resolveAdmin(actor);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const sourceTemplate = dto.sourceTemplateId
      ? await this.prisma.formTemplate.findFirst({
          where: { id: dto.sourceTemplateId, deletedAt: null, isActive: true },
          include: { questions: { orderBy: { position: 'asc' } } },
        })
      : null;

    if (dto.sourceTemplateId && !sourceTemplate) {
      throw new NotFoundException('Template not found');
    }

    const questions =
      dto.questions.length > 0
        ? dto.questions
        : (sourceTemplate?.questions.map((question) => ({
            position: question.position,
            fieldKey: question.fieldKey,
            label: question.label,
            questionType: question.questionType,
            isRequired: question.isRequired,
            placeholder: question.placeholder ?? undefined,
            options: Array.isArray(question.options) ? (question.options as string[]) : undefined,
            validationRules:
              question.validationRules && typeof question.validationRules === 'object'
                ? (question.validationRules as Record<string, unknown>)
                : undefined,
          })) ?? []);

    if (questions.length === 0) {
      throw new BadRequestException({
        code: 'FORM_QUESTIONS_REQUIRED',
        message: 'Registration form must include at least one question',
      });
    }

    this.validateQuestions(questions);

    const latest = await this.prisma.registrationForm.findFirst({
      where: { eventId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const version = dto.version ?? (latest?.version ?? 0) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      const form = await tx.registrationForm.create({
        data: {
          eventId,
          version,
          status: (dto.status as FormStatus | undefined) ?? FormStatus.PUBLISHED,
          sourceTemplateId: dto.sourceTemplateId,
          createdByAdminId: admin.id,
          publishedAt: ((dto.status as FormStatus | undefined) ?? FormStatus.PUBLISHED) === FormStatus.PUBLISHED ? new Date() : null,
        },
        select: {
          id: true,
          eventId: true,
          version: true,
          status: true,
        },
      });

      await tx.formQuestion.createMany({
        data: questions.map((question) => ({
          formId: form.id,
          position: question.position,
          fieldKey: question.fieldKey,
          label: question.label,
          questionType: question.questionType as QuestionType,
          isRequired: question.isRequired,
          placeholder: question.placeholder,
          options: this.toInputJson(question.options),
          validationRules: this.toInputJson(question.validationRules),
        })),
      });

      return form;
    });

    await this.logAdminAction(admin.userId, 'ADMIN_EVENT_FORM_CREATED', 'registration_form', created.id, {
      eventId,
      version,
      questionsCount: questions.length,
    });

    return created;
  }

  async createFormTemplate(actor: AuthenticatedUser, dto: CreateFormTemplateAdminDto) {
    const admin = await this.resolveAdmin(actor);
    this.validateQuestions(dto.questions);

    const latest = await this.prisma.formTemplate.findFirst({
      where: { templateCode: dto.templateCode },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const version = (latest?.version ?? 0) + 1;

    const template = await this.prisma.$transaction(async (tx) => {
      const created = await tx.formTemplate.create({
        data: {
          templateCode: dto.templateCode,
          version,
          name: dto.name,
          description: dto.description,
          createdByAdminId: admin.id,
          isActive: true,
        },
        select: {
          id: true,
          templateCode: true,
          version: true,
          name: true,
          isActive: true,
        },
      });

      await tx.templateQuestion.createMany({
        data: dto.questions.map((question) => ({
          templateId: created.id,
          position: question.position,
          fieldKey: question.fieldKey,
          label: question.label,
          questionType: question.questionType as QuestionType,
          isRequired: question.isRequired,
          placeholder: question.placeholder,
          options: this.toInputJson(question.options),
          validationRules: this.toInputJson(question.validationRules),
        })),
      });

      return created;
    });

    await this.logAdminAction(admin.userId, 'ADMIN_FORM_TEMPLATE_CREATED', 'form_template', template.id, {
      templateCode: template.templateCode,
      version,
      questionsCount: dto.questions.length,
    });

    return template;
  }

  async listFormTemplates(actor: AuthenticatedUser, query: AdminFormTemplatesQueryDto) {
    await this.resolveAdmin(actor);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.FormTemplateWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { templateCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.formTemplate.findMany({
        where,
        orderBy: [{ templateCode: 'asc' }, { version: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          templateCode: true,
          version: true,
          name: true,
          description: true,
          isActive: true,
          questions: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              position: true,
              fieldKey: true,
              label: true,
              questionType: true,
              isRequired: true,
              placeholder: true,
              options: true,
              validationRules: true,
            },
          },
        },
      }),
      this.prisma.formTemplate.count({ where }),
    ]);

    return { items, meta: { page, pageSize, total } };
  }

  async createEventFromTemplate(actor: AuthenticatedUser, dto: CreateEventFromTemplateDto) {
    const admin = await this.resolveAdmin(actor);
    const { startAt, endAt } = this.validateEventDates(dto.startAt, dto.endAt);

    const template = await this.prisma.formTemplate.findFirst({
      where: {
        id: dto.templateId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        questions: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.questions.length === 0) {
      throw new BadRequestException({
        code: 'TEMPLATE_WITHOUT_QUESTIONS',
        message: 'Template should contain at least one question',
      });
    }

    this.validateQuestions(
      template.questions.map((question) => ({
        position: question.position,
        fieldKey: question.fieldKey,
        label: question.label,
        questionType: question.questionType,
        isRequired: question.isRequired,
        placeholder: question.placeholder ?? undefined,
        options: Array.isArray(question.options) ? (question.options as string[]) : undefined,
        validationRules:
          question.validationRules && typeof question.validationRules === 'object'
            ? (question.validationRules as Record<string, unknown>)
            : undefined,
      })),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: dto.title,
          description: dto.description,
          startAt,
          endAt,
          location: dto.location,
          capacity: dto.capacity,
          status: (dto.status as EventStatus | undefined) ?? EventStatus.DRAFT,
          createdByAdminId: admin.id,
        },
      });

      const form = await tx.registrationForm.create({
        data: {
          eventId: event.id,
          version: 1,
          status: (dto.formStatus as FormStatus | undefined) ?? FormStatus.PUBLISHED,
          sourceTemplateId: template.id,
          createdByAdminId: admin.id,
          publishedAt:
            ((dto.formStatus as FormStatus | undefined) ?? FormStatus.PUBLISHED) === FormStatus.PUBLISHED
              ? new Date()
              : null,
        },
      });

      await tx.formQuestion.createMany({
        data: template.questions.map((question) => ({
          formId: form.id,
          position: question.position,
          fieldKey: question.fieldKey,
          label: question.label,
          questionType: question.questionType,
          isRequired: question.isRequired,
          placeholder: question.placeholder,
          options: this.toInputJson(question.options),
          validationRules: this.toInputJson(question.validationRules),
        })),
      });

      return {
        eventId: event.id,
        formId: form.id,
      };
    });

    await this.logAdminAction(admin.userId, 'ADMIN_EVENT_CREATED_FROM_TEMPLATE', 'event', result.eventId, {
      templateId: template.id,
      formId: result.formId,
    });

    return result;
  }

  async getEventRegistrations(actor: AuthenticatedUser, eventId: string, query: AdminRegistrationsQueryDto) {
    await this.resolveAdmin(actor);

    const eventExists = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });

    if (!eventExists) {
      throw new NotFoundException('Event not found');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.EventRegistrationWhereInput = {
      eventId,
      deletedAt: null,
      ...(query.status
        ? { status: query.status as RegistrationStatus }
        : !query.includeCanceled
          ? { status: RegistrationStatus.ACTIVE }
          : {}),
      ...(query.search
        ? {
            OR: [
              { userProfile: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { user: { vkUserId: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orderBy = this.buildRegistrationsOrderBy(query.sortBy, query.sortOrder);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.eventRegistration.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          registeredAt: true,
          canceledAt: true,
          user: {
            select: {
              vkUserId: true,
            },
          },
          userProfile: {
            select: {
              fullName: true,
            },
          },
        },
      }),
      this.prisma.eventRegistration.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        registeredAt: item.registeredAt,
        canceledAt: item.canceledAt,
        userProfile: {
          fullName: item.userProfile.fullName,
          vkUserId: item.user.vkUserId,
        },
      })),
      meta: { page, pageSize, total },
    };
  }

  async updateRegistrationStatus(
    actor: AuthenticatedUser,
    eventId: string,
    registrationId: string,
    dto: UpdateRegistrationStatusDto,
  ) {
    const admin = await this.resolveAdmin(actor);
    const nextStatus = dto.status as RegistrationStatus;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const registration = await tx.eventRegistration.findFirst({
        where: {
          id: registrationId,
          eventId,
          deletedAt: null,
          event: { deletedAt: null },
        },
        select: {
          id: true,
          eventId: true,
          userId: true,
          status: true,
          registeredAt: true,
          canceledAt: true,
          event: {
            select: {
              capacity: true,
            },
          },
          user: {
            select: {
              vkUserId: true,
            },
          },
          userProfile: {
            select: {
              fullName: true,
            },
          },
        },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found');
      }

      if (registration.status === nextStatus) {
        return {
          previousStatus: registration.status,
          updated: registration,
        };
      }

      if (nextStatus === RegistrationStatus.ACTIVE) {
        if (registration.event.capacity !== null) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
        }

        const duplicateActive = await tx.eventRegistration.findFirst({
          where: {
            id: { not: registrationId },
            eventId,
            userId: registration.userId,
            status: RegistrationStatus.ACTIVE,
            activeMarker: 1,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (duplicateActive) {
          throw new ConflictException({
            code: 'ACTIVE_REGISTRATION_EXISTS',
            message: 'Active registration already exists for this user and event',
          });
        }

        if (registration.event.capacity !== null) {
          const activeCount = await tx.eventRegistration.count({
            where: {
              eventId,
              status: RegistrationStatus.ACTIVE,
              activeMarker: 1,
              deletedAt: null,
            },
          });

          if (activeCount >= registration.event.capacity) {
            throw new ConflictException({
              code: 'EVENT_CAPACITY_REACHED',
              message: 'No available places left for this event',
            });
          }
        }
      }

      const updated = await tx.eventRegistration.update({
        where: { id: registrationId },
        data:
          nextStatus === RegistrationStatus.ACTIVE
            ? {
                status: RegistrationStatus.ACTIVE,
                activeMarker: 1,
                canceledAt: null,
                canceledByUserId: null,
                cancelReason: null,
              }
            : {
                status: RegistrationStatus.CANCELED,
                activeMarker: null,
                canceledAt: now,
                canceledByUserId: admin.userId,
                cancelReason: dto.reason?.trim() || 'Changed by admin',
              },
        select: {
          id: true,
          status: true,
          registeredAt: true,
          canceledAt: true,
          user: {
            select: {
              vkUserId: true,
            },
          },
          userProfile: {
            select: {
              fullName: true,
            },
          },
        },
      });

      if (nextStatus === RegistrationStatus.CANCELED) {
        await tx.reminder.updateMany({
          where: {
            eventRegistrationId: registrationId,
            status: ReminderStatus.SCHEDULED,
            deletedAt: null,
          },
          data: {
            status: ReminderStatus.CANCELED,
            canceledAt: now,
          },
        });
      }

      return {
        previousStatus: registration.status,
        updated,
      };
    });

    await this.logAdminAction(admin.userId, 'ADMIN_REGISTRATION_STATUS_CHANGED', 'event_registration', registrationId, {
      eventId,
      previousStatus: result.previousStatus,
      nextStatus,
    });

    return {
      id: result.updated.id,
      status: result.updated.status,
      registeredAt: result.updated.registeredAt,
      canceledAt: result.updated.canceledAt,
      userProfile: {
        fullName: result.updated.userProfile.fullName,
        vkUserId: result.updated.user.vkUserId,
      },
    };
  }

  async exportEventRegistrationsToExcel(
    actor: AuthenticatedUser,
    eventId: string,
    query: ExportRegistrationsQueryDto,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const admin = await this.resolveAdmin(actor);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, title: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const registrations = await this.prisma.eventRegistration.findMany({
      where: {
        eventId,
        deletedAt: null,
        ...(!query.includeCanceled ? { status: RegistrationStatus.ACTIVE } : {}),
      },
      orderBy: { registeredAt: 'asc' },
      select: {
        status: true,
        registeredAt: true,
        user: {
          select: {
            vkUserId: true,
          },
        },
        userProfile: {
          select: {
            fullName: true,
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registrations');

    worksheet.columns = [
      { header: 'ФИ', key: 'fullName', width: 30 },
      { header: 'VK ID', key: 'vkUserId', width: 18 },
      { header: 'Ссылка на VK', key: 'vkProfileUrl', width: 34 },
      { header: 'Дата записи', key: 'registeredAt', width: 28 },
      { header: 'Статус', key: 'status', width: 14 },
    ];

    for (const item of registrations) {
      const vkProfileUrl = item.user.vkUserId ? `https://vk.com/id${item.user.vkUserId}` : null;
      worksheet.addRow({
        fullName: item.userProfile.fullName,
        vkUserId: item.user.vkUserId,
        vkProfileUrl: vkProfileUrl ? { text: vkProfileUrl, hyperlink: vkProfileUrl } : '',
        registeredAt: this.formatExportDateTime(item.registeredAt),
        status: item.status,
      });
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.getColumn('vkProfileUrl').font = { color: { argb: 'FF2563EB' }, underline: true };

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const safeFileName = `event-${eventId}-registrations.xlsx`;

    await this.logAdminAction(admin.userId, 'ADMIN_EXPORT_EXCEL', 'event', eventId, {
      rows: registrations.length,
      includeCanceled: !!query.includeCanceled,
    });

    return {
      fileName: safeFileName,
      buffer,
    };
  }

  async createNotificationCampaign(
    actor: AuthenticatedUser,
    eventId: string,
    dto: CreateNotificationCampaignDto,
  ) {
    const admin = await this.resolveAdmin(actor);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const status = (dto.status as CampaignStatus | undefined) ?? CampaignStatus.QUEUED;

    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        eventId,
        createdByAdminId: admin.id,
        title: dto.title,
        message: dto.message,
        status,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
      select: {
        id: true,
        status: true,
        title: true,
        createdAt: true,
      },
    });

    let recipientsCount = 0;

    if (status === CampaignStatus.QUEUED) {
      const activeRegistrations = await this.prisma.eventRegistration.findMany({
        where: {
          eventId,
          deletedAt: null,
          status: RegistrationStatus.ACTIVE,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      recipientsCount = activeRegistrations.length;

      if (activeRegistrations.length > 0) {
        await this.prisma.notificationRecipient.createMany({
          data: activeRegistrations.map((registration) => ({
            campaignId: campaign.id,
            userId: registration.userId,
            eventRegistrationId: registration.id,
            status: RecipientStatus.PENDING,
          })),
          skipDuplicates: true,
        });
      }

      await this.prisma.notificationCampaign.update({
        where: { id: campaign.id },
        data: {
          totalRecipients: recipientsCount,
          status: CampaignStatus.QUEUED,
          startedAt: null,
          completedAt: null,
        },
      });
    }

    await this.logAdminAction(admin.userId, 'ADMIN_CAMPAIGN_CREATED', 'notification_campaign', campaign.id, {
      eventId,
      status,
      recipientsCount,
    });

    return {
      ...campaign,
      recipientsCount,
    };
  }

  private async resolveAdmin(actor: AuthenticatedUser) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const admin = actor.adminId
      ? await this.prisma.admin.findFirst({
          where: {
            id: actor.adminId,
            userId: actor.userId,
            isActive: true,
            deletedAt: null,
            user: {
              deletedAt: null,
              status: 'ACTIVE',
            },
          },
          select: { id: true, userId: true },
        })
      : await this.prisma.admin.findFirst({
          where: {
            userId: actor.userId,
            isActive: true,
            deletedAt: null,
            user: {
              deletedAt: null,
              status: 'ACTIVE',
            },
          },
          select: { id: true, userId: true },
        });

    if (!admin) {
      throw new ForbiddenException('Admin account is not active');
    }

    return admin;
  }

  private validateEventDates(startAtRaw: string, endAtRaw: string): { startAt: Date; endAt: Date } {
    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException({ code: 'INVALID_EVENT_DATES', message: 'Invalid event dates' });
    }

    if (endAt <= startAt) {
      throw new BadRequestException({ code: 'INVALID_EVENT_RANGE', message: 'endAt must be after startAt' });
    }

    return { startAt, endAt };
  }

  private validateQuestions(questions: AdminQuestionInput[]): void {
    const positionSet = new Set<number>();
    const keySet = new Set<string>();

    for (const question of questions) {
      if (question.questionType === 'PHONE' || question.questionType === 'EMAIL') {
        throw new BadRequestException({
          code: 'CONTACT_QUESTION_TYPES_DISABLED',
          message: 'Phone and email questions are disabled in the MVP because these personal data fields are not collected',
        });
      }

      if (positionSet.has(question.position)) {
        throw new BadRequestException({
          code: 'DUPLICATE_QUESTION_POSITION',
          message: `Duplicate question position ${question.position}`,
        });
      }
      positionSet.add(question.position);

      if (keySet.has(question.fieldKey)) {
        throw new BadRequestException({
          code: 'DUPLICATE_QUESTION_KEY',
          message: `Duplicate question key ${question.fieldKey}`,
        });
      }
      keySet.add(question.fieldKey);

      if (
        (question.questionType === 'SELECT' || question.questionType === 'CHECKBOX' || question.questionType === 'COURSE') &&
        (!Array.isArray(question.options) || question.options.length === 0)
      ) {
        throw new BadRequestException({
          code: 'QUESTION_OPTIONS_REQUIRED',
          message: `Question ${question.fieldKey} requires options`,
        });
      }
    }
  }

  private buildRegistrationsOrderBy(
    sortBy: AdminRegistrationsQueryDto['sortBy'],
    sortOrder: AdminRegistrationsQueryDto['sortOrder'],
  ): Prisma.EventRegistrationOrderByWithRelationInput {
    const order = sortOrder ?? 'desc';

    if (sortBy === 'fullName') {
      return { userProfile: { fullName: order } };
    }

    if (sortBy === 'canceledAt') {
      return { canceledAt: order };
    }

    return { registeredAt: order };
  }

  private formatExportDateTime(value: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value).replace(',', '');
  }

  private async logAdminAction(
    actorUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      actorId: actorUserId,
      actorRole: 'ADMIN',
      action,
      targetType,
      targetId,
      metadata,
    });
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === null || value === undefined) {
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
      const objectValue: Record<string, Prisma.InputJsonValue> = {};
      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        const parsed = this.toInputJson(nestedValue);
        if (parsed !== undefined) {
          objectValue[key] = parsed;
        }
      }
      return objectValue;
    }

    return undefined;
  }
}
