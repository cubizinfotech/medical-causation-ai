import type { AuthSettings } from './config.types';

/** Every product API requires a signed-in user. JWT_SECRET must be set. */
export const authConfig = (): AuthSettings => ({
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
});
