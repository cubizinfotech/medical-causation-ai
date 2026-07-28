import type { AppSettings } from './config.types';

export const appConfig = (): AppSettings => ({
  name: process.env.APP_NAME ?? 'Medical Causation AI API',
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
});
