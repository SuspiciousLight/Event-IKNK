import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditService {
  private readonly sensitiveMetadataKeyPattern =
    /(^|_)(password|token|secret|cookie|email|phone|fullName|vkUserId|telegramUsername|answerText|answerJson|payload|rawPayload)($|_)/i;

  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    actorId?: string;
    actorRole?: 'USER' | 'ADMIN';
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const metadata = this.toJsonValue(input.metadata);

    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async list(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      actorId: query.actorId,
      action: query.action,
      targetType: query.targetType,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, meta: { page, pageSize, total } };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.toJsonValue(item))
        .filter((item): item is Prisma.InputJsonValue => item !== undefined);
    }

    if (typeof value === 'object') {
      const objectValue: Record<string, Prisma.InputJsonValue> = {};
      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (this.sensitiveMetadataKeyPattern.test(key)) {
          objectValue[key] = '[REDACTED]';
          continue;
        }

        const parsed = this.toJsonValue(nestedValue);
        if (parsed !== undefined) {
          objectValue[key] = parsed;
        }
      }
      return objectValue;
    }

    return undefined;
  }
}
