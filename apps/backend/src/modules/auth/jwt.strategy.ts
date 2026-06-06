import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../common/constants/role.enum';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: { cookies?: Record<string, string> } | undefined) =>
          request?.cookies?.[configService.get<string>('JWT_COOKIE_NAME', 'admin_access_token')] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.role !== Role.ADMIN && payload.role !== Role.USER) {
      throw new UnauthorizedException('Invalid role in token');
    }

    return {
      userId: payload.sub,
      role: payload.role,
      adminId: payload.adminId,
    };
  }
}

function getJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret && configService.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return secret || 'dev_only_change_me';
}
