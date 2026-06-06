import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { CsrfOriginGuard } from './common/guards/csrf-origin.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RateLimitService } from './common/rate-limit/rate-limit.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    RegistrationsModule,
    RemindersModule,
    ConsentsModule,
    AdminModule,
    AuditModule,
    HealthModule,
    NotificationsModule,
  ],
  providers: [
    RateLimitService,
    {
      provide: APP_GUARD,
      useClass: CsrfOriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
})
export class AppModule {}
