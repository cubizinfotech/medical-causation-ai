import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUserRef } from './auth.types';

export function requireRequestUser(
  request: Request & { user?: AuthUserRef },
): AuthUserRef {
  if (!request.user) {
    throw new UnauthorizedException('Authentication is required.');
  }
  return request.user;
}
