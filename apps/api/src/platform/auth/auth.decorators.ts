import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '../users/user.types';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';

/** Skip authentication (health checks and login only). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Require one of these roles in addition to being signed in. */
export const Roles = (...roles: PlatformRole[]) =>
  SetMetadata(ROLES_KEY, roles);
