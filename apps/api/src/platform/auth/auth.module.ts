import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { AuthSettings } from '@config/config.types';
import { RedisModule } from '@redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { AccessGuard } from './access.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Shared authentication. MCA and EWI use this module; they do not own users.
 * Every route needs a signed-in user unless it is marked @Public().
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.get<AuthSettings>('auth');
        return {
          // AuthService refuses to start without a strong secret.
          secret: auth?.jwtSecret,
          signOptions: {
            expiresIn: (auth?.jwtExpiresIn ??
              '12h') as JwtSignOptions['expiresIn'],
          },
        };
      },
    }),
    RedisModule,
    AuditModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessGuard,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
