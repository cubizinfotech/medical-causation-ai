import type { LoggingSettings } from './config.types';

export const loggingConfig = (): LoggingSettings => ({
  level: process.env.LOG_LEVEL ?? 'info',
  prettyPrint: process.env.LOG_PRETTY_PRINT === 'true',
});
