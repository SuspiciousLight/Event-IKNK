import { BadRequestException } from '@nestjs/common';
import { ConsentType, EventStatus, FormStatus, RegistrationStatus } from '@prisma/client';
import { CURRENT_PERSONAL_DATA_CONSENT } from '../src/modules/consents/current-consent';
import { RegistrationsService } from '../src/modules/registrations/registrations.service';

const validConsent = {
  accepted: true,
  version: CURRENT_PERSONAL_DATA_CONSENT.version,
  textHash: CURRENT_PERSONAL_DATA_CONSENT.textHash,
};

const baseDto = {
  eventId: 'event-1',
  registrationFormId: 'form-1',
  answers: [],
  consent: validConsent,
};

const buildPrismaMock = () => {
  const txMock = {
    eventRegistration: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'registration-1',
        eventId: 'event-1',
        status: RegistrationStatus.ACTIVE,
        registeredAt: new Date('2026-04-26T10:00:00.000Z'),
      }),
    },
    registrationAnswer: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    consent: {
      create: jest.fn().mockResolvedValue({
        id: 'consent-1',
        consentVersion: validConsent.version,
        consentTextHash: validConsent.textHash,
        acceptedAt: new Date('2026-04-26T10:00:01.000Z'),
      }),
    },
    seatWaitlistSubscription: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        vkUserId: '123456',
        status: 'ACTIVE',
        deletedAt: null,
        profile: {
          id: 'profile-1',
          fullName: 'Иванов Иван',
          telegramUsername: '@student_2026',
          isActive: true,
          deletedAt: null,
        },
      }),
    },
    event: {
      // Future-relative so the "registration closed after start" guard never trips here.
      findFirst: jest.fn().mockResolvedValue({
        id: 'event-1',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 26 * 60 * 60 * 1000),
        capacity: null,
      }),
    },
    registrationForm: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'form-1',
        eventId: 'event-1',
        status: FormStatus.PUBLISHED,
        questions: [],
      }),
    },
    eventRegistration: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    __tx: txMock,
  };

  return prisma;
};

describe('RegistrationsService consent handling', () => {
  it('rejects registration when consent checkbox was not accepted', async () => {
    const prisma = buildPrismaMock();
    const service = new RegistrationsService(prisma as never, { log: jest.fn() } as never);

    await expect(
      service.createRegistration('user-1', {
        ...baseDto,
        consent: {
          ...validConsent,
          accepted: false,
        },
      } as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CONSENT_REQUIRED',
      } as never),
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('creates consent linked to the created registration and event', async () => {
    const prisma = buildPrismaMock();
    const auditService = { log: jest.fn() };
    const service = new RegistrationsService(prisma as never, auditService as never);

    const result = await service.createRegistration('user-1', baseDto);

    expect(prisma.__tx.consent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        eventId: 'event-1',
        eventRegistrationId: 'registration-1',
        consentType: ConsentType.PERSONAL_DATA_PROCESSING,
        consentVersion: validConsent.version,
        consentTextHash: validConsent.textHash,
        contextKey: 'registration-1',
      }),
      select: expect.objectContaining({
        acceptedAt: true,
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'registration-1',
        eventId: 'event-1',
        status: RegistrationStatus.ACTIVE,
        profileUsed: expect.objectContaining({
          id: 'profile-1',
          fullName: 'Иванов Иван',
        }),
        consent: expect.objectContaining({
          version: validConsent.version,
          textHash: validConsent.textHash,
        }),
      }),
    );
    expect(result.profileUsed).not.toHaveProperty('phone');
    expect(result.profileUsed).not.toHaveProperty('email');
    expect(result.profileUsed).not.toHaveProperty('vkUserId');
    expect(result.profileUsed).not.toHaveProperty('telegramUsername');
  });

  it('normalizes unexpected consent metadata to a bad request', async () => {
    const prisma = buildPrismaMock();
    const service = new RegistrationsService(prisma as never, { log: jest.fn() } as never);

    await expect(
      service.createRegistration('user-1', {
        ...baseDto,
        consent: {
          ...validConsent,
          textHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RegistrationsService registration resume', () => {
  it('reactivates a canceled registration without creating a duplicate record', async () => {
    const futureStartAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureEndAt = new Date(Date.now() + 26 * 60 * 60 * 1000);
    const auditService = { log: jest.fn() };

    const txMock = {
      $executeRaw: jest.fn(),
      eventRegistration: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'registration-1',
            eventId: 'event-1',
            userId: 'user-1',
            status: RegistrationStatus.CANCELED,
            event: {
              id: 'event-1',
              title: 'День карьеры',
              startAt: futureStartAt,
              endAt: futureEndAt,
              location: 'Главный корпус',
              capacity: 10,
              status: EventStatus.PUBLISHED,
              deletedAt: null,
            },
          })
          .mockResolvedValueOnce(null),
        count: jest.fn().mockResolvedValue(3),
        update: jest.fn().mockResolvedValue({
          id: 'registration-1',
          eventId: 'event-1',
          status: RegistrationStatus.ACTIVE,
          registeredAt: new Date('2026-04-26T10:00:00.000Z'),
          canceledAt: null,
          cancelReason: null,
          event: {
            id: 'event-1',
            title: 'День карьеры',
            startAt: futureStartAt,
            endAt: futureEndAt,
            location: 'Главный корпус',
            status: EventStatus.PUBLISHED,
          },
          reminders: [],
        }),
      },
      seatWaitlistSubscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    };
    const service = new RegistrationsService(prisma as never, auditService as never);

    const result = await service.resumeRegistration('user-1', 'registration-1');

    expect(txMock.eventRegistration.update).toHaveBeenCalledWith({
      where: { id: 'registration-1' },
      data: expect.objectContaining({
        status: RegistrationStatus.ACTIVE,
        activeMarker: 1,
        canceledAt: null,
        canceledByUserId: null,
        cancelReason: null,
      }),
      select: expect.any(Object),
    });
    expect(result).toEqual(expect.objectContaining({
      id: 'registration-1',
      status: RegistrationStatus.ACTIVE,
      event: expect.objectContaining({ title: 'День карьеры' }),
    }));
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1',
      actorRole: 'USER',
      action: 'REGISTRATION_RESUMED',
      targetType: 'event_registration',
      targetId: 'registration-1',
    }));
  });
});
