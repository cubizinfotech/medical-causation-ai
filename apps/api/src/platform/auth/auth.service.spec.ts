import { UnauthorizedException } from '@nestjs/common';
import { hashPassword } from './password';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const settings = {
    jwtSecret: 'x'.repeat(32),
    jwtExpiresIn: '1h',
  };

  async function service(overrides: { jwtSecret?: string } = {}) {
    const passwordHash = await hashPassword('password');
    const user = {
      id: 'user-1',
      email: 'attorney@example.com',
      displayName: 'Attorney',
      roles: ['attorney'],
      permissions: ['mca:*', 'ewi:*'],
      passwordHash,
    };
    const users = {
      findByEmail: jest.fn((email: string) =>
        Promise.resolve(email === user.email ? user : null),
      ),
      findById: jest.fn(() => Promise.resolve(user)),
    };
    const jwt = {
      signAsync: jest.fn(() => Promise.resolve('signed-token')),
      verifyAsync: jest.fn(() =>
        Promise.resolve({
          sub: 'user-1',
          jti: 'token-1',
          exp: Math.floor(Date.now() / 1000) + 600,
        }),
      ),
    };
    const revoked = new Set<string>();
    const client = {
      set: jest.fn((key: string) => {
        revoked.add(key);
        return Promise.resolve('OK');
      }),
      exists: jest.fn((key: string) =>
        Promise.resolve(revoked.has(key) ? 1 : 0),
      ),
    };
    const redis = { getClient: () => client };
    const audit = { record: jest.fn(() => Promise.resolve()) };
    const config = { get: jest.fn(() => ({ ...settings, ...overrides })) };
    return {
      auth: new AuthService(
        config as never,
        users as never,
        jwt as never,
        redis as never,
        audit as never,
      ),
      jwt,
      client,
      audit,
    };
  }

  it('rejects a wrong password and records the failure', async () => {
    const { auth, audit } = await service();
    await expect(
      auth.login('attorney@example.com', 'nope'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_failed' }),
    );
  });

  it('rejects an unknown email the same way', async () => {
    const { auth } = await service();
    await expect(
      auth.login('nobody@example.com', 'password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns a token with an id for a valid password without the hash', async () => {
    const { auth, jwt } = await service();
    const result = await auth.login('attorney@example.com', 'password');
    expect(result.accessToken).toBe('signed-token');
    expect(result.user.roles).toEqual(['attorney']);
    expect(result).not.toHaveProperty('passwordHash');
    const [payload, options] = jwt.signAsync.mock.calls[0] as unknown as [
      { sub: string; email: string },
      { jwtid?: string },
    ];
    expect(payload).toMatchObject({
      sub: 'user-1',
      email: 'attorney@example.com',
    });
    expect(typeof options.jwtid).toBe('string');
  });

  it('stops accepting a token after logout', async () => {
    const { auth } = await service();
    expect(await auth.validateAccessToken('token')).not.toBeNull();
    await auth.logout('token');
    expect(await auth.validateAccessToken('token')).toBeNull();
  });

  it('refuses to start without a strong JWT secret', async () => {
    const { auth } = await service({ jwtSecret: 'short' });
    expect(() => auth.onModuleInit()).toThrow(/JWT_SECRET/);
  });
});
