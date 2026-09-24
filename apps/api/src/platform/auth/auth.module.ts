import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { AuthSettings } from '@config/config.types';
import { UsersModule } from '../users/users.module';
import { AccessGuard } from './access.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

/**
 * Shared authentication. MCA and EWI use this module; they do not own users.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.get<AuthSettings>('auth');
        return {
          secret: auth?.jwtSecret || 'auth-disabled',
          signOptions: {
            expiresIn: (auth?.jwtExpiresIn ??
              '7d') as JwtSignOptions['expiresIn'],
          },
        };
      },
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AccessGuard,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
