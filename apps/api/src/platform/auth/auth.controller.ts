import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PLATFORM_ROLES, USER_LIST_ROLES } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { Public, Roles } from './auth.decorators';
import { AuthService } from './auth.service';
import type { AuthUserRef } from './auth.types';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Get('status')
  status() {
    return this.auth.status();
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Roles(...PLATFORM_ROLES)
  @Get('me')
  me(@Req() request: Request & { user?: AuthUserRef }) {
    return request.user;
  }

  @Roles(...USER_LIST_ROLES)
  @Get('users')
  listUsers() {
    return this.users.list();
  }
}
