import { UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '../src/common/constants/role.enum';
import { RequestWithUser } from '../src/common/interfaces/request-with-user.interface';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

const originalEnv = { ...process.env };

const buildRequest = (headers: Record<string, string> = {}): RequestWithUser =>
  ({
    headers,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.2' },
  }) as RequestWithUser;

const buildResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }) as unknown as Response & { cookie: jest.Mock; clearCookie: jest.Mock };

describe('AuthController admin cookie flow', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sets admin JWT only as HttpOnly cookie and never returns the token body', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_COOKIE_SAME_SITE;
    delete process.env.ADMIN_COOKIE_SECURE;
    delete process.env.JWT_COOKIE_NAME;

    const authService = {
      loginAdmin: jest.fn().mockResolvedValue({
        token: 'signed-jwt-token',
        user: { sub: 'user-1', role: Role.ADMIN, adminId: 'admin-1' },
      }),
    };
    const controller = new AuthController(authService as unknown as AuthService);
    const response = buildResponse();

    const result = await controller.loginAdmin(
      { login: 'admin', password: 'StrongPass123' },
      buildRequest({
        'x-forwarded-for': '10.0.0.1, 10.0.0.2',
        'user-agent': 'jest-agent',
      }),
      response,
    );

    expect(result).toEqual({
      sub: 'user-1',
      role: Role.ADMIN,
      adminId: 'admin-1',
    });
    expect(result).not.toHaveProperty('token');
    expect(authService.loginAdmin).toHaveBeenCalledWith(
      { login: 'admin', password: 'StrongPass123' },
      { ipAddress: '10.0.0.1', userAgent: 'jest-agent' },
    );
    expect(response.cookie).toHaveBeenCalledWith('admin_access_token', 'signed-jwt-token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
  });

  it('uses Secure SameSite=None cookie settings in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_COOKIE_SAME_SITE = 'none';
    delete process.env.ADMIN_COOKIE_SECURE;

    const authService = {
      loginAdmin: jest.fn().mockResolvedValue({
        token: 'signed-jwt-token',
        user: { sub: 'user-1', role: Role.ADMIN, adminId: 'admin-1' },
      }),
    };
    const controller = new AuthController(authService as unknown as AuthService);
    const response = buildResponse();

    await controller.loginAdmin(
      { login: 'admin', password: 'StrongPass123' },
      buildRequest(),
      response,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      'admin_access_token',
      'signed-jwt-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }),
    );
  });

  it('clears the same admin cookie on logout', async () => {
    process.env.JWT_COOKIE_NAME = 'custom_admin_cookie';
    process.env.ADMIN_COOKIE_SAME_SITE = 'strict';
    process.env.ADMIN_COOKIE_SECURE = 'true';

    const authService = { logoutAdmin: jest.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(authService as unknown as AuthService);
    const response = buildResponse();

    const result = await controller.logoutAdmin(
      { userId: 'user-1', role: Role.ADMIN, adminId: 'admin-1' },
      buildRequest({ 'user-agent': 'jest-agent' }),
      response,
    );

    expect(result).toEqual({ success: true });
    expect(authService.logoutAdmin).toHaveBeenCalledWith(
      { userId: 'user-1', role: Role.ADMIN, adminId: 'admin-1' },
      { ipAddress: '127.0.0.1', userAgent: 'jest-agent' },
    );
    expect(response.clearCookie).toHaveBeenCalledWith('custom_admin_cookie', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
  });
});

describe('AuthService admin login audit', () => {
  it('audits failed login attempts by hash without writing raw login to logs', async () => {
    const prisma = {
      admin: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(prisma as never, { signAsync: jest.fn() } as never, auditService as never);

    await expect(service.loginAdmin(
      { login: 'Admin@Example.com', password: 'WrongPass123' },
      { ipAddress: '10.0.0.1', userAgent: 'jest-agent' },
    )).rejects.toBeInstanceOf(UnauthorizedException);

    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'admin_session',
      ipAddress: '10.0.0.1',
      userAgent: 'jest-agent',
      metadata: {
        loginHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    }));
    expect(auditService.log.mock.calls[0][0].metadata).not.toHaveProperty('login');
  });
});
