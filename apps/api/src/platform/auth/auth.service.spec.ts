import { UnauthorizedException } from '@nestjs/common';
import { hashPassword } from './password';
import { AuthService } from './auth.service';

describe('AuthService login', () => {
  const settings = {
    enabled: true,
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
  };

  async function service() {
    const passwordHash = await hashPassword('password');
    const users = {
      findByEmail: jest.fn((email: string) =>
        Promise.resolve(
          email === 'attorney@example.com'
            ? {
                id: 'user-1',
                email,
                displayName: 'Attorney',
                roles: ['attorney'],
                permissions: ['mca:*', 'ewi:*'],
                passwordHash,
              }
            : null,
        ),
      ),
      findById: jest.fn(),
    };
    const jwt = {
      signAsync: jest.fn(() => Promise.resolve('signed-token')),
      verifyAsync: jest.fn(),
    };
    const config = { get: jest.fn(() => settings) };
    return {
      auth: new AuthService(config as never, users as never, jwt as never),
      jwt,
    };
  }

  it('rejects a wrong password', async () => {
    const { auth } = await service();
    await expect(
      auth.login('attorney@example.com', 'nope'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns a token for a valid password without including the hash', async () => {
    const { auth, jwt } = await service();
    const result = await auth.login('attorney@example.com', 'password');
    expect(result.accessToken).toBe('signed-token');
    expect(result.user.roles).toEqual(['attorney']);
    expect(result).not.toHaveProperty('passwordHash');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', email: 'attorney@example.com' }),
    );
  });

  it('refuses to start when auth is enabled without a JWT secret', () => {
    const config = {
      get: jest.fn(() => ({
        enabled: true,
        jwtSecret: '',
        jwtExpiresIn: '1h',
      })),
    };
    const auth = new AuthService(config as never, {} as never, {} as never);
    expect(() => auth.onModuleInit()).toThrow(/JWT_SECRET/);
  });
});
