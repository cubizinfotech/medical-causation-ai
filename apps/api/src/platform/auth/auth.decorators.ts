import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '../users/user.types';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';

/** Skip authentication even when AUTH_ENABLED is true. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Require one of these roles. This check runs even when product APIs are open. */
export const Roles = (...roles: PlatformRole[]) =>
  SetMetadata(ROLES_KEY, roles);
