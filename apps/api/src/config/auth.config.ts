import type { AuthSettings } from './config.types';

export const authConfig = (): AuthSettings => ({
  enabled:
    process.env.FEATURE_AUTH === 'true' || process.env.AUTH_ENABLED === 'true',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
});
