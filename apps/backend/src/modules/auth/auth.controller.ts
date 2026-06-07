import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CookieOptions, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  @HttpCode(200)
  @RateLimit({ limit: 5, windowMs: 15 * 60 * 1000, keyPrefix: 'admin-login' })
  async loginAdmin(
    @Body() dto: LoginDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginAdmin(dto, this.getRequestAuditContext(request));

    response.cookie(this.getAdminCookieName(), result.token, {
      ...this.getAdminCookieOptions(),
      maxAge: 12 * 60 * 60 * 1000,
    });

    return {
      sub: result.user.sub,
      role: result.user.role,
      adminId: result.user.adminId,
    };
  }

  @Post('admin/logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async logoutAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logoutAdmin(user, this.getRequestAuditContext(request));

    response.clearCookie(this.getAdminCookieName(), this.getAdminCookieOptions());

    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }

  private getAdminCookieName(): string {
    return process.env.JWT_COOKIE_NAME || 'admin_access_token';
  }

  private getAdminCookieOptions(): CookieOptions {
    const sameSite = this.getCookieSameSite();
    const secure = this.getCookieSecure(sameSite);

    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
    };
  }

  private getCookieSameSite(): CookieOptions['sameSite'] {
    const configured = process.env.ADMIN_COOKIE_SAME_SITE?.trim().toLowerCase();
    if (configured === 'lax' || configured === 'strict' || configured === 'none') {
      return configured;
    }

    return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
  }

  private getCookieSecure(sameSite: CookieOptions['sameSite']): boolean {
    const configured = process.env.ADMIN_COOKIE_SECURE?.trim().toLowerCase();
    if (configured === 'true' || configured === '1') {
      return true;
    }
    if (configured === 'false' || configured === '0') {
      return false;
    }

    return sameSite === 'none' || process.env.NODE_ENV === 'production';
  }

  private getRequestAuditContext(request: RequestWithUser): { ipAddress?: string; userAgent?: string } {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : request.ip || request.socket.remoteAddress;

    return {
      ipAddress,
      userAgent: request.headers['user-agent']?.toString(),
    };
  }
}
