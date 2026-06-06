import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, FormStatus, Prisma, RegistrationStatus, SeatWaitlistStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventsQueryDto } from './dto/events-query.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(query: EventsQueryDto, userId: string) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      status: EventStatus.PUBLISHED,
      // Hide finished events from the public afisha.
      endAt: { gte: new Date() },
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        // Soonest upcoming first by default; explicit sortOrder still respected.
        orderBy: { startAt: query.sortOrder ?? 'asc' },
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
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    const myActiveByEvent = await this.getMyActiveRegistrations(
      userId,
      items.map((event) => event.id),
    );
    const myWaitlistByEvent = await this.getMyActiveWaitlistSubscriptions(
      userId,
      items.map((event) => event.id),
    );

    return {
      items: items.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        location: event.location,
        capacity: event.capacity,
        status: event.status,
        registeredCount: event._count.registrations,
        availableSeats: event.capacity === null ? null : Math.max(event.capacity - event._count.registrations, 0),
        myRegistrationId: myActiveByEvent.get(event.id) ?? null,
        myWaitlistStatus: myWaitlistByEvent.get(event.id)?.status ?? null,
      })),
      meta: { page, pageSize, total },
    };
  }

  private async getMyActiveRegistrations(
    userId: string,
    eventIds: string[],
  ): Promise<Map<string, string>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const registrations = await this.prisma.eventRegistration.findMany({
      where: {
        userId,
        eventId: { in: eventIds },
        status: RegistrationStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true, eventId: true },
    });

    return new Map(registrations.map((registration) => [registration.eventId, registration.id]));
  }

  private async getMyActiveWaitlistSubscriptions(
    userId: string,
    eventIds: string[],
  ): Promise<Map<string, { id: string; status: SeatWaitlistStatus }>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const subscriptions = await this.prisma.seatWaitlistSubscription.findMany({
      where: {
        userId,
        eventId: { in: eventIds },
        status: { in: [SeatWaitlistStatus.ACTIVE, SeatWaitlistStatus.NOTIFIED] },
        deletedAt: null,
      },
      select: { id: true, eventId: true, status: true },
    });

    return new Map(subscriptions.map((subscription) => [subscription.eventId, subscription]));
  }

  async getEventCard(eventId: string, userId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        deletedAt: null,
        status: EventStatus.PUBLISHED,
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
        _count: {
          select: {
            registrations: {
              where: {
                status: RegistrationStatus.ACTIVE,
                deletedAt: null,
              },
            },
          },
        },
        forms: {
          where: {
            deletedAt: null,
            status: FormStatus.PUBLISHED,
          },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            status: true,
            publishedAt: true,
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
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const myRegistration = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId,
        userId,
        status: RegistrationStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });

    const waitlist = await this.prisma.seatWaitlistSubscription.findFirst({
      where: {
        eventId,
        userId,
        status: { in: [SeatWaitlistStatus.ACTIVE, SeatWaitlistStatus.NOTIFIED] },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        notifiedAt: true,
        canceledAt: true,
      },
    });

    return {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        location: event.location,
        capacity: event.capacity,
        status: event.status,
        registeredCount: event._count.registrations,
        availableSeats: event.capacity === null ? null : Math.max(event.capacity - event._count.registrations, 0),
      },
      activeForm: event.forms[0] || null,
      myRegistration: myRegistration ? { id: myRegistration.id } : null,
      myWaitlistSubscription: waitlist,
    };
  }

  async getWaitlistStatus(eventId: string, userId: string) {
    const summary = await this.getWaitlistSummary(eventId, userId);
    return summary;
  }

  async subscribeToSeatWaitlist(eventId: string, userId: string) {
    const summary = await this.getWaitlistSummary(eventId, userId);

    if (summary.myRegistration) {
      throw new ConflictException({
        code: 'ALREADY_REGISTERED',
        message: 'User is already registered for this event',
      });
    }

    if (!summary.isFull) {
      throw new ConflictException({
        code: 'SEATS_AVAILABLE',
        message: 'Seats are available now, registration should be used instead of waitlist',
      });
    }

    if (summary.subscription?.status === SeatWaitlistStatus.ACTIVE) {
      return summary;
    }

    const subscription = await this.prisma.seatWaitlistSubscription.create({
      data: {
        eventId,
        userId,
        status: SeatWaitlistStatus.ACTIVE,
        activeMarker: 1,
      },
      select: this.waitlistSelect(),
    });

    return {
      ...summary,
      subscription,
      canSubscribe: false,
    };
  }

  async cancelSeatWaitlist(eventId: string, userId: string) {
    await this.ensureEventExists(eventId);

    const subscription = await this.prisma.seatWaitlistSubscription.findFirst({
      where: {
        eventId,
        userId,
        status: SeatWaitlistStatus.ACTIVE,
        activeMarker: 1,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!subscription) {
      throw new NotFoundException('Waitlist subscription not found');
    }

    await this.prisma.seatWaitlistSubscription.update({
      where: { id: subscription.id },
      data: {
        status: SeatWaitlistStatus.CANCELED,
        activeMarker: null,
        canceledAt: new Date(),
      },
    });

    return this.getWaitlistSummary(eventId, userId);
  }

  private async getWaitlistSummary(eventId: string, userId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        deletedAt: null,
        status: EventStatus.PUBLISHED,
      },
      select: {
        id: true,
        capacity: true,
        _count: {
          select: {
            registrations: {
              where: {
                status: RegistrationStatus.ACTIVE,
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const [myRegistration, subscription] = await this.prisma.$transaction([
      this.prisma.eventRegistration.findFirst({
        where: {
          eventId,
          userId,
          status: RegistrationStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true },
      }),
      this.prisma.seatWaitlistSubscription.findFirst({
        where: {
          eventId,
          userId,
          status: { in: [SeatWaitlistStatus.ACTIVE, SeatWaitlistStatus.NOTIFIED] },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: this.waitlistSelect(),
      }),
    ]);

    const availableSeats = event.capacity === null ? null : Math.max(event.capacity - event._count.registrations, 0);
    const isFull = event.capacity !== null && availableSeats === 0;

    return {
      eventId: event.id,
      capacity: event.capacity,
      registeredCount: event._count.registrations,
      availableSeats,
      isFull,
      myRegistration,
      subscription,
      canSubscribe: isFull && !myRegistration && subscription?.status !== SeatWaitlistStatus.ACTIVE,
    };
  }

  private async ensureEventExists(eventId: string): Promise<void> {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        deletedAt: null,
        status: EventStatus.PUBLISHED,
      },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }
  }

  private waitlistSelect() {
    return {
      id: true,
      status: true,
      createdAt: true,
      notifiedAt: true,
      canceledAt: true,
    } as const;
  }
}
