import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { AuthSettings } from '@config/config.types';
import type { Request } from 'express';
import type { PlatformRole } from '../users/user.types';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators';
import { AuthService } from './auth.service';
import type { AuthUserRef } from './auth.types';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles =
      this.reflector.getAllAndOverride<PlatformRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const authEnabled = this.config.get<AuthSettings>('auth')?.enabled === true;
    if (!authEnabled && requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUserRef }>();
    const token = readBearer(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Authentication is required.');
    }
    const user = await this.auth.validateAccessToken(token);
    if (!user) {
      throw new UnauthorizedException('Authentication is required.');
    }
    request.user = user;
    if (
      requiredRoles.length > 0 &&
      !user.roles.some((role) => requiredRoles.includes(role))
    ) {
      throw new ForbiddenException('You do not have access to this resource.');
    }
    return true;
  }
}

function readBearer(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}
