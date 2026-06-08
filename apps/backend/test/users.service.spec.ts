import { ReminderStatus, RegistrationStatus, SeatWaitlistStatus, UserStatus } from '@prisma/client';
import { UsersService } from '../src/modules/users/users.service';

const buildPrismaMock = () => {
  const txMock = {
    user: {
      update: jest.fn().mockResolvedValue({
        id: 'user-1',
        status: UserStatus.DEACTIVATED,
        deletedAt: new Date('2026-06-09T10:00:00.000Z'),
      }),
    },
    userProfile: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    eventRegistration: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    reminder: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    registrationAnswer: {
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    seatWaitlistSubscription: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
        deletedAt: null,
        profile: { id: 'profile-1', deletedAt: null },
      }),
    },
    $transaction: jest.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    __tx: txMock,
  };

  return prisma;
};

describe('UsersService profile deactivation', () => {
  it('soft-deactivates user data and cancels active user-owned records', async () => {
    const prisma = buildPrismaMock();
    const auditService = { log: jest.fn() };
    const service = new UsersService(prisma as never, auditService as never);

    const result = await (
      service as unknown as {
        deactivateMyProfile: (userId: string) => Promise<{ success: boolean; deactivatedAt: Date }>;
      }
    ).deactivateMyProfile('user-1');

    expect(prisma.__tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        status: UserStatus.DEACTIVATED,
        vkUserId: null,
        deletedAt: expect.any(Date),
      }),
      select: expect.objectContaining({
        id: true,
        status: true,
        deletedAt: true,
      }),
    });
    expect(prisma.__tx.userProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', deletedAt: null },
      data: expect.objectContaining({
        fullName: 'Удаленный пользователь',
        telegramUsername: null,
        isActive: false,
        deactivatedAt: expect.any(Date),
        deletedAt: expect.any(Date),
      }),
    });
    expect(prisma.__tx.eventRegistration.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: RegistrationStatus.ACTIVE, deletedAt: null },
      data: expect.objectContaining({
        status: RegistrationStatus.CANCELED,
        activeMarker: null,
        canceledAt: expect.any(Date),
      }),
    });
    expect(prisma.__tx.reminder.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: ReminderStatus.SCHEDULED, deletedAt: null },
      data: expect.objectContaining({
        status: ReminderStatus.CANCELED,
        canceledAt: expect.any(Date),
      }),
    });
    expect(prisma.__tx.registrationAnswer.updateMany).toHaveBeenCalledWith({
      where: {
        eventRegistration: {
          userId: 'user-1',
        },
      },
      data: expect.objectContaining({
        answerText: null,
      }),
    });
    expect(prisma.__tx.seatWaitlistSubscription.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: SeatWaitlistStatus.ACTIVE, deletedAt: null },
      data: expect.objectContaining({
        status: SeatWaitlistStatus.CANCELED,
        activeMarker: null,
        canceledAt: expect.any(Date),
      }),
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        actorRole: 'USER',
        action: 'PROFILE_DEACTIVATED',
        targetType: 'user',
        targetId: 'user-1',
      }),
    );
    expect(result).toEqual({
      success: true,
      deactivatedAt: expect.any(Date),
    });
  });
});
