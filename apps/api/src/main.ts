import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import type { AppSettings } from '@config/config.types';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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

  console.log(
    `[AI] Active provider: ${aiConfig.activeProvider}, model: ${aiConfig.models[aiConfig.activeProvider] ?? 'provider default'}`,
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: appConfig.frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(appConfig.port);
}

void bootstrap();
