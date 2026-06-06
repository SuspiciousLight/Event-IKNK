import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '../../common/constants/role.enum';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async loginAdmin(
    dto: LoginDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ token: string; user: JwtPayload }> {
    const admin = await this.prisma.admin.findUnique({
      where: { login: dto.login.toLowerCase() },
      include: { user: true },
    });

    if (!admin || admin.deletedAt || !admin.isActive || !admin.user || admin.user.status !== 'ACTIVE') {
      await this.auditAdminLoginFailure(dto.login, context);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await compare(dto.password, admin.passwordHash);
    if (!isValidPassword) {
      await this.auditAdminLoginFailure(dto.login, context);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: admin.userId,
      role: Role.ADMIN,
      adminId: admin.id,
    };

    const token = await this.jwtService.signAsync(payload);

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      actorId: admin.userId,
      actorRole: 'ADMIN',
      action: 'ADMIN_LOGIN',
      targetType: 'admin_session',
      targetId: admin.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { token, user: payload };
  }

  async logoutAdmin(user: AuthenticatedUser, context?: { ipAddress?: string; userAgent?: string }): Promise<void> {
    await this.auditService.log({
      actorId: user.userId,
      actorRole: 'ADMIN',
      action: 'ADMIN_LOGOUT',
      targetType: 'admin_session',
      targetId: user.adminId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  async getMe(userId: string): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        deletedAt: true,
        admin: {
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found');
    }

    if (user.role === Role.ADMIN) {
      if (!user.admin || !user.admin.isActive || user.admin.deletedAt) {
        throw new UnauthorizedException('Admin session is not active');
      }

      return {
        sub: user.id,
        role: Role.ADMIN,
        adminId: user.admin.id,
      };
    }

    return {
      sub: user.id,
      role: Role.USER,
    };
  }

  private async auditAdminLoginFailure(login: string, context?: { ipAddress?: string; userAgent?: string }) {
    await this.auditService.log({
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'admin_session',
      metadata: {
        loginHash: createHash('sha256').update(login.trim().toLowerCase()).digest('hex'),
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }
}
