import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { AuthSettings } from '@config/config.types';
import type { Socket } from 'socket.io';
import { RedisService } from '@redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import type { PlatformUser } from '../users/user.types';
import type {
  AccessTokenPayload,
  AuthUserRef,
  IAuthService,
} from './auth.types';
import { hashPassword, verifyPassword } from './password';

/** Shorter secrets can be brute-forced offline from one captured token. */
export const MIN_JWT_SECRET_LENGTH = 32;

@Injectable()
export class AuthService implements IAuthService, OnModuleInit {
  /** Checked when the email is unknown, so response time does not reveal accounts. */
  private unknownUserHash?: Promise<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    const { jwtSecret } = this.settings();
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be set to at least ${MIN_JWT_SECRET_LENGTH} random characters (for example: openssl rand -hex 32).`,
      );
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    user: AuthUserRef;
  }> {
    const record = await this.users.findByEmail(email);
    const matches = await verifyPassword(
      password,
      record?.passwordHash ??
        (await (this.unknownUserHash ??= hashPassword(randomUUID()))),
    );
    if (!record || !matches) {
      void this.audit.record({
        product: 'platform',
        action: 'auth.login_failed',
        actorId: record?.id,
        metadata: { email: email.trim().toLowerCase() },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }
    const user = toRef(record);
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      jwtid: randomUUID(),
    });
    void this.audit.record({
      product: 'platform',
      action: 'auth.login',
      actorId: user.id,
    });
    return { accessToken, user };
  }

  /** Ends this token now instead of when it expires. */
  async logout(token: string): Promise<void> {
    const payload = await this.verify(token);
    if (!payload?.jti || !payload.exp) return;
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.getClient().set(revokedKey(payload.jti), '1', 'EX', ttl);
    }
    void this.audit.record({
      product: 'platform',
      action: 'auth.logout',
      actorId: payload.sub,
    });
  }

  async validateAccessToken(token: string): Promise<AuthUserRef | null> {
    const payload = await this.verify(token);
    if (!payload?.jti) return null;
    if (await this.redis.getClient().exists(revokedKey(payload.jti))) {
      return null;
    }
    const user = await this.users.findById(payload.sub);
    return user ? toRef(user) : null;
  }

  /** Job updates require the same signed-in user as the HTTP APIs. */
  async allowSocket(client: Socket): Promise<boolean> {
    const token = readSocketToken(client);
    if (!token) return false;
    const user = await this.validateAccessToken(token);
    if (!user) return false;
    const data = client.data as { user?: AuthUserRef };
    data.user = user;
    return true;
  }

  private async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      return null;
    }
  }

  private settings(): AuthSettings {
    return (
      this.config.get<AuthSettings>('auth') ?? {
        jwtSecret: '',
        jwtExpiresIn: '12h',
      }
    );
  }
}

function revokedKey(jti: string): string {
  return `auth:revoked:${jti}`;
}

function toRef(user: PlatformUser): AuthUserRef {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
    avatarUpdatedAt: user.avatarUpdatedAt,
  };
}

export function readBearer(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function readSocketToken(client: Socket): string | null {
  const auth = client.handshake.auth as { token?: unknown } | undefined;
  if (typeof auth?.token === 'string' && auth.token.trim()) {
    return auth.token.trim();
  }
  const header = client.handshake.headers.authorization;
  return typeof header === 'string' ? readBearer(header) : null;
}
