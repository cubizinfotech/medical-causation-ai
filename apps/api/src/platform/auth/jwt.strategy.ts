import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthSettings } from '@config/config.types';
import { UsersService } from '../users/users.service';
import type { AccessTokenPayload, AuthUserRef } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    const auth = config.get<AuthSettings>('auth');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth?.jwtSecret || 'auth-disabled',
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUserRef | null> {
    const user = await this.users.findById(payload.sub);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    };
  }
}
