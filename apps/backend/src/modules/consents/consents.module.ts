import { Module } from '@nestjs/common';
import { VkUserAuthGuard } from '../../common/guards/vk-user-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';

@Module({
  imports: [AuditModule],
  controllers: [ConsentsController],
  providers: [ConsentsService, VkUserAuthGuard],
  exports: [ConsentsService],
})
export class ConsentsModule {}
