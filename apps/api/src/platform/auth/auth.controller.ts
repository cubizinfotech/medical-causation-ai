import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  PLATFORM_ROLES,
  USER_LIST_ROLES,
  type ProfileDetailsInput,
} from '../users/user.types';
import { UsersService } from '../users/users.service';
import { ProfileService } from '../users/profile.service';
import { parseAvatarDataUrl } from '../users/avatar';
import { Public, Roles } from './auth.decorators';
import { AuthService } from './auth.service';
import type { AuthUserRef } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto, UploadAvatarDto } from './dto/update-profile.dto';
import { requireRequestUser } from './request-user';

type AuthedRequest = Request & { user?: AuthUserRef };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly profiles: ProfileService,
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
  me(@Req() request: AuthedRequest) {
    return request.user;
  }

  @Roles(...PLATFORM_ROLES)
  @Get('profile')
  profile(@Req() request: AuthedRequest) {
    return this.profiles.getProfile(requireRequestUser(request).id);
  }

  @Roles(...PLATFORM_ROLES)
  @Patch('profile')
  async updateProfile(
    @Req() request: AuthedRequest,
    @Body() body: UpdateProfileDto,
  ) {
    const userId = requireRequestUser(request).id;
    await this.users.updateProfile(userId, toProfileInput(body));
    return this.profiles.getProfile(userId);
  }

  @Roles(...PLATFORM_ROLES)
  @Put('profile/avatar')
  async uploadAvatar(
    @Req() request: AuthedRequest,
    @Body() body: UploadAvatarDto,
  ) {
    const userId = requireRequestUser(request).id;
    await this.users.setAvatar(userId, parseAvatarDataUrl(body.dataUrl));
    return this.profiles.getProfile(userId);
  }

  @Roles(...PLATFORM_ROLES)
  @Delete('profile/avatar')
  async removeAvatar(@Req() request: AuthedRequest) {
    const userId = requireRequestUser(request).id;
    await this.users.clearAvatar(userId);
    return this.profiles.getProfile(userId);
  }

  @Roles(...PLATFORM_ROLES)
  @Get('profile/avatar')
  async avatar(
    @Req() request: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const image = await this.users.getAvatar(requireRequestUser(request).id);
    res.set({
      'Content-Type': image.mimeType,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(image.data);
  }

  @Roles(...USER_LIST_ROLES)
  @Get('users')
  listUsers() {
    return this.users.list();
  }
}

/** Fields left out of the request stay unchanged; empty strings clear them. */
function toProfileInput(body: UpdateProfileDto): ProfileDetailsInput {
  const optional = (value: string | undefined) =>
    value === undefined ? undefined : value || null;
  return {
    displayName: body.displayName,
    jobTitle: optional(body.jobTitle),
    organization: optional(body.organization),
    phone: optional(body.phone),
    location: optional(body.location),
    bio: optional(body.bio),
  };
}
