import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { frontendOrigins } from '@config/frontend-origins';
import type { AppSettings } from '@config/config.types';
import { SocketIoAdapter } from '@platform/http/socket-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppSettings>('app');
  const aiConfig = configService.get<{
    activeProvider: string;
    models: Record<string, string>;
  }>('ai');

  if (!appConfig) {
    throw new Error('Application configuration is not available');
  }

  if (!aiConfig) {
    throw new Error('AI configuration is not available');
  }

  logger.log(
    `AI provider: ${aiConfig.activeProvider}, model: ${aiConfig.models[aiConfig.activeProvider] ?? 'provider default'}`,
  );

  // Caddy runs on the same machine. Trust its X-Forwarded-For so rate limits
  // see the real client address; a remote client cannot fake it.
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  // The API serves JSON and files only, so the strictest policy fits.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  const origins = frontendOrigins(
    appConfig.frontendUrl,
    appConfig.apiPublicUrl,
  );
  const allowedOrigins = origins.length > 0 ? origins : [appConfig.frontendUrl];

  app.useWebSocketAdapter(new SocketIoAdapter(app, allowedOrigins));
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(appConfig.port, host);
  logger.log(`API listening on http://${host}:${appConfig.port}`);
}

void bootstrap();
