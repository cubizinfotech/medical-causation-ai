import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthSettings } from '@config/config.types';
import type { Socket } from 'socket.io';
import { UsersService } from '../users/users.service';
import type { PlatformUser } from '../users/user.types';
import type {
  AccessTokenPayload,
  AuthUserRef,
  IAuthService,
} from './auth.types';
import { verifyPassword } from './password';

@Injectable()
export class AuthService implements IAuthService, OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  onModuleInit(): void {
    const auth = this.settings();
    if (auth.enabled && !auth.jwtSecret) {
      throw new Error('JWT_SECRET is required when AUTH_ENABLED is true.');
    }
  }

  status(): { enabled: boolean } {
    return { enabled: this.settings().enabled };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    user: AuthUserRef;
  }> {
    const auth = this.settings();
    if (!auth.jwtSecret) {
      throw new UnauthorizedException('Authentication is not configured.');
    }
    const record = await this.users.findByEmail(email);
    if (!record) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const matches = await verifyPassword(password, record.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const user = toRef(record);
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user };
  }

  async validateAccessToken(token: string): Promise<AuthUserRef | null> {
    const auth = this.settings();
    if (!auth.jwtSecret) return null;
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      const user = await this.users.findById(payload.sub);
      return user ? toRef(user) : null;
    } catch {
      return null;
    }
  }

  /** When auth is off, sockets stay open. When it is on, a valid token is required. */
  async allowSocket(client: Socket): Promise<boolean> {
    if (!this.settings().enabled) return true;
    const token = readSocketToken(client);
    if (!token) return false;
    const user = await this.validateAccessToken(token);
    if (!user) return false;
    const data = client.data as { user?: AuthUserRef };
    data.user = user;
    return true;
  }

  private settings(): AuthSettings {
    return (
      this.config.get<AuthSettings>('auth') ?? {
        enabled: false,
        jwtSecret: '',
        jwtExpiresIn: '7d',
      }
    );
  }
}

function toRef(user: PlatformUser): AuthUserRef {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
  };
}

function readSocketToken(client: Socket): string | null {
  const auth = client.handshake.auth as { token?: unknown } | undefined;
  if (typeof auth?.token === 'string' && auth.token.trim()) {
    return auth.token.trim();
  }
  const header = client.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return null;
}
