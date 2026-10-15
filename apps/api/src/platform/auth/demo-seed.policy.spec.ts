import { demoSeedPassword } from './demo-seed.policy';

describe('demo seed policy', () => {
  it('refuses to seed demo users in production without the override', () => {
    expect(() =>
      demoSeedPassword('production', undefined, 'a-long-password-1'),
    ).toThrow(/ALLOW_DEMO_SEED/);
  });

  it('uses DEMO_USER_PASSWORD in production when seeding is allowed', () => {
    expect(() => demoSeedPassword('production', 'true', undefined)).toThrow(
      /DEMO_USER_PASSWORD/,
    );
    expect(() => demoSeedPassword('production', 'true', '')).toThrow(
      /DEMO_USER_PASSWORD/,
    );
    expect(demoSeedPassword('production', 'true', 'password')).toBe('password');
  });

  it('uses the simple demo password locally unless one is set', () => {
    expect(demoSeedPassword('development', undefined, undefined)).toBe(
      'password',
    );
    expect(demoSeedPassword('development', undefined, 'chosen')).toBe('chosen');
  });
});
