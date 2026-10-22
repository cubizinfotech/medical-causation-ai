import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Redirect,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '@platform/auth/auth.decorators';
import type { AuthUserRef } from '@platform/auth/auth.types';
import { requireRequestUser } from '@platform/auth/request-user';
import { OAuthRateLimit } from '@platform/rate-limit/rate-limit';
import { OrcidOAuthService } from './orcid-oauth.service';

type AuthedRequest = Request & { user?: AuthUserRef };

/**
 * User ORCID authorization-code OAuth. Nest has no global prefix, so these
 * paths are /orcid/authorize, /orcid/callback, and /orcid/connection.
 * On the IP Caddy layout the public callback is /api/orcid/callback.
 */
@Controller('orcid')
export class OrcidOAuthController {
  constructor(private readonly oauth: OrcidOAuthService) {}

  /**
   * Starts the authorization-code flow. The SPA calls this with a Bearer
   * token, then sends the browser to authorizationUrl (ORCID's page).
   */
  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @OAuthRateLimit()
  async authorize(
    @Req() request: AuthedRequest,
  ): Promise<{ authorizationUrl: string }> {
    const authorizationUrl = await this.oauth.start(
      requireRequestUser(request).id,
    );
    return { authorizationUrl };
  }

  /**
   * ORCID redirects the browser here. No JWT is present; validity comes
   * from the one-time Redis state created by POST /orcid/authorize.
   */
  @Public()
  @OAuthRateLimit()
  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.oauth.handleCallback({ code, state, error });
    return { url, statusCode: 302 };
  }

  /** Public ORCID iD for this signed-in user. Never includes tokens. */
  @Get('connection')
  connection(@Req() request: AuthedRequest) {
    return this.oauth.publicConnection(requireRequestUser(request).id);
  }
}
