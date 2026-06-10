import { ExecutionContext, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Role } from '../src/common/constants/role.enum';
import { CsrfOriginGuard } from '../src/common/guards/csrf-origin.guard';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service';

const createHttpContext = (request: Record<string, unknown>): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('allows routes without role metadata', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(createHttpContext({ user: undefined }))).toBe(true);
  });

  it('allows only users with required backend role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(createHttpContext({ user: { role: Role.ADMIN } }))).toBe(true);
    expect(guard.canActivate(createHttpContext({ user: { role: Role.USER } }))).toBe(false);
    expect(guard.canActivate(createHttpContext({ user: undefined }))).toBe(false);
  });
});

describe('RateLimitGuard', () => {
  it('allows requests until route limit is exceeded and then returns 429', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({ limit: 2, windowMs: 60_000, keyPrefix: 'admin-login' }),
    };
    const guard = new RateLimitGuard(reflector as unknown as Reflector, new RateLimitService());
    const request = {
      method: 'POST',
      path: '/auth/admin/login',
      route: { path: '/auth/admin/login' },
      headers: {},
      ip: '127.0.0.1',
      socket: {},
    };

    expect(guard.canActivate(createHttpContext(request))).toBe(true);
    expect(guard.canActivate(createHttpContext(request))).toBe(true);

    try {
      guard.canActivate(createHttpContext(request));
      throw new Error('Expected rate limit exception');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((error as HttpException).getResponse()).toEqual(expect.objectContaining({
        code: 'RATE_LIMITED',
      }));
    }
  });
});

describe('CsrfOriginGuard', () => {
  const buildGuard = () => new CsrfOriginGuard({
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'JWT_COOKIE_NAME') {
        return 'admin_access_token';
      }
      if (key === 'CORS_ORIGIN') {
        return 'https://event-iknk.ru';
      }
      if (key === 'CSRF_TRUSTED_ORIGINS') {
        return 'https://vk.com,https://m.vk.com';
      }
      return fallback;
    }),
  } as unknown as ConfigService);

  it('allows safe methods and non-cookie user requests', () => {
    const guard = buildGuard();

    expect(guard.canActivate(createHttpContext({
      method: 'GET',
      headers: { cookie: 'admin_access_token=token', origin: 'https://evil.example' },
    }))).toBe(true);
    expect(guard.canActivate(createHttpContext({
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    }))).toBe(true);
  });

  it('allows trusted cookie-authenticated admin requests', () => {
    const guard = buildGuard();

    expect(guard.canActivate(createHttpContext({
      method: 'POST',
      headers: {
        cookie: 'admin_access_token=token',
        origin: 'https://event-iknk.ru',
        'x-requested-with': 'VKMiniApp',
        'sec-fetch-site': 'same-origin',
      },
    }))).toBe(true);
  });

  it('blocks untrusted origins and missing trusted request header for cookie auth', () => {
    const guard = buildGuard();

    expect(() => guard.canActivate(createHttpContext({
      method: 'POST',
      headers: {
        cookie: 'admin_access_token=token',
        origin: 'https://evil.example',
        'x-requested-with': 'VKMiniApp',
      },
    }))).toThrow(ForbiddenException);

    expect(() => guard.canActivate(createHttpContext({
      method: 'POST',
      headers: {
        cookie: 'admin_access_token=token',
        origin: 'https://event-iknk.ru',
      },
    }))).toThrow(ForbiddenException);
  });
});
