import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { Role } from '../constants/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class VkUserAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser & Request>();
    const vkUserId = this.resolveVkUserId(request);

    if (!vkUserId) {
      throw new UnauthorizedException({
        code: 'VK_AUTH_REQUIRED',
        message: 'VK launch parameters are required',
      });
    }

    const user = await this.prisma.user.upsert({
      where: { vkUserId },
      update: {},
      create: {
        vkUserId,
        role: Role.USER,
      },
      select: {
        id: true,
        role: true,
        status: true,
        deletedAt: true,
      },
    });

    if (user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is not active',
      });
    }

    request.user = {
      userId: user.id,
      role: user.role as Role,
    };

    return true;
  }

  private resolveVkUserId(request: Request): string | null {
    const launchParams = this.parseLaunchParams(request.headers['x-vk-launch-params']);
    const vkUserIdFromParams = launchParams?.get('vk_user_id');

    if (launchParams?.get('sign')) {
      if (this.isValidLaunchParamsSignature(launchParams)) {
        return this.normalizeVkUserId(vkUserIdFromParams);
      }

      if (this.isSignatureEnforced()) {
        throw new UnauthorizedException({
          code: 'VK_SIGNATURE_INVALID',
          message: 'VK launch parameters signature is invalid',
        });
      }
    }

    if (this.isSignatureEnforced()) {
      throw new UnauthorizedException({
        code: 'VK_SIGNATURE_REQUIRED',
        message: 'Signed VK launch parameters are required in production',
      });
    }

    return (
      this.normalizeVkUserId(vkUserIdFromParams) ??
      this.normalizeVkUserId(this.getHeaderValue(request.headers['x-vk-user-id'])) ??
      this.normalizeVkUserId(this.configService.get<string>('DEV_VK_USER_ID', '100001'))
    );
  }

  private isSignatureEnforced(): boolean {
    return (
      this.configService.get<string>('NODE_ENV') === 'production' ||
      this.configService.get<string>('VK_SIGNATURE_ENFORCED') === 'true'
    );
  }

  private parseLaunchParams(headerValue: string | string[] | undefined): URLSearchParams | null {
    const rawHeader = this.getHeaderValue(headerValue);
    if (!rawHeader) {
      return null;
    }

    let raw = rawHeader;
    try {
      raw = decodeURIComponent(rawHeader);
    } catch {
      raw = rawHeader;
    }

    const normalized = raw.replace(/^[?#]/, '');
    return normalized ? new URLSearchParams(normalized) : null;
  }

  private isValidLaunchParamsSignature(params: URLSearchParams): boolean {
    const receivedSign = params.get('sign');
    const secret = this.configService.get<string>('VK_APP_SECRET');

    if (!receivedSign || !secret) {
      return false;
    }

    const signPayload = Array.from(params.entries())
      .filter(([key]) => key.startsWith('vk_'))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const expectedSign = createHmac('sha256', secret)
      .update(signPayload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return this.safeCompare(receivedSign, expectedSign);
  }

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private normalizeVkUserId(value: string | null | undefined): string | null {
    if (!value || !/^\d{1,32}$/.test(value)) {
      return null;
    }

    return value;
  }

  private getHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
