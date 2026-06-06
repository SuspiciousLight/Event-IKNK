import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  private readonly trustedOrigins: Set<string>;
  private readonly cookieName: string;

  constructor(configService: ConfigService) {
    this.cookieName = configService.get<string>('JWT_COOKIE_NAME', 'admin_access_token');
    this.trustedOrigins = new Set([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      ...this.parseOrigins(configService.get<string>('CORS_ORIGIN')),
      ...this.parseOrigins(configService.get<string>('CSRF_TRUSTED_ORIGINS')),
    ]);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    if (!this.usesCookieAuth(request)) {
      return true;
    }

    const fetchSite = request.headers['sec-fetch-site'];
    if (typeof fetchSite === 'string' && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
      throw new ForbiddenException({ code: 'CSRF_BLOCKED', message: 'Cross-site request is not allowed' });
    }

    const origin = this.getOrigin(request);
    if (origin && !this.trustedOrigins.has(origin)) {
      throw new ForbiddenException({ code: 'CSRF_BLOCKED', message: 'Request origin is not trusted' });
    }

    const requestedWith = request.headers['x-requested-with'];
    if (requestedWith !== 'VKMiniApp') {
      throw new ForbiddenException({ code: 'CSRF_BLOCKED', message: 'Missing trusted request header' });
    }

    return true;
  }

  private usesCookieAuth(request: Request): boolean {
    const cookie = request.headers.cookie;
    return typeof cookie === 'string' && cookie.includes(`${this.cookieName}=`);
  }

  private getOrigin(request: Request): string | null {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && origin.trim()) {
      return origin;
    }

    const referer = request.headers.referer;
    if (typeof referer !== 'string' || !referer.trim()) {
      return null;
    }

    try {
      return new URL(referer).origin;
    } catch {
      throw new ForbiddenException({ code: 'CSRF_BLOCKED', message: 'Invalid referer header' });
    }
  }

  private parseOrigins(value?: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}
