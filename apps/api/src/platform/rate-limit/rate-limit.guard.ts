import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUserRef } from '../auth/auth.types';

/**
 * Limits HTTP requests per signed-in user, or per client address before
 * sign-in. WebSocket messages are not limited here (they need a valid token).
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return Promise.resolve(true);
    return super.canActivate(context);
  }

  protected getTracker(request: {
    ip?: string;
    user?: AuthUserRef;
  }): Promise<string> {
    return Promise.resolve(
      request.user ? `user:${request.user.id}` : `ip:${request.ip ?? ''}`,
    );
  }
}
