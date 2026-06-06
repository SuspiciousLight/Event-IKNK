import { Module } from '@nestjs/common';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [AuditModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, VkUserAuthGuard],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
