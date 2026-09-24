import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators';
import { AccessGuard } from './access.guard';
import type { AuthUserRef } from './auth.types';

describe('AccessGuard', () => {
  const user: AuthUserRef = {
    id: 'user-1',
    email: 'attorney@example.com',
    displayName: 'Attorney',
    roles: ['attorney'],
  };

  function setup(options: {
    enabled: boolean;
    publicRoute?: boolean;
    roles?: string[];
    authorization?: string;
    tokenUser?: AuthUserRef | null;
  }) {
    const request: { headers: { authorization?: string }; user?: AuthUserRef } =
      {
        headers: { authorization: options.authorization },
      };
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC_KEY) return options.publicRoute ?? false;
        if (key === ROLES_KEY) return options.roles;
        return undefined;
      }),
    };
    const config = {
      get: jest.fn(() => ({
        enabled: options.enabled,
        jwtSecret: 'secret',
        jwtExpiresIn: '1h',
      })),
    };
    const auth = {
      validateAccessToken: jest.fn(() =>
        Promise.resolve(
          options.tokenUser === undefined ? user : options.tokenUser,
        ),
      ),
    };
    const guard = new AccessGuard(
      reflector as never,
      config as never,
      auth as never,
    );
    const context = {
      getType: () => 'http',
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { guard, context, request, auth };
  }

  it('allows a public route without a token', async () => {
    const { guard, context } = setup({ enabled: true, publicRoute: true });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('leaves product routes open when authentication is disabled', async () => {
    const { guard, context, auth } = setup({ enabled: false });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(auth.validateAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a missing token when authentication is enabled', async () => {
    const { guard, context } = setup({ enabled: true });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid token', async () => {
    const { guard, context } = setup({
      enabled: true,
      authorization: 'Bearer bad',
      tokenUser: null,
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows a signed-in user on a product route', async () => {
    const { guard, context, request } = setup({
      enabled: true,
      authorization: 'Bearer good',
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user?.email).toBe('attorney@example.com');
  });

  it('rejects a role that is not allowed', async () => {
    const { guard, context } = setup({
      enabled: true,
      authorization: 'Bearer good',
      roles: ['admin'],
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a matching role and still checks the token when auth is off', async () => {
    const { guard, context } = setup({
      enabled: false,
      authorization: 'Bearer good',
      roles: ['attorney'],
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
