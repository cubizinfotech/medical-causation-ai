import { demoSeedPassword } from './demo-seed.policy';

describe('demo seed policy', () => {
  it('refuses to seed demo users in production without the override', () => {
    expect(() =>
      demoSeedPassword('production', undefined, 'a-long-password-1'),
    ).toThrow(/ALLOW_DEMO_SEED/);
  });

  it('needs a real password in production', () => {
    expect(() => demoSeedPassword('production', 'true', undefined)).toThrow(
      /DEMO_USER_PASSWORD/,
    );
    expect(() => demoSeedPassword('production', 'true', 'short')).toThrow(
      /DEMO_USER_PASSWORD/,
    );
    expect(demoSeedPassword('production', 'true', 'a-long-password-1')).toBe(
      'a-long-password-1',
    );
  });

  it('uses the simple demo password locally unless one is set', () => {
    expect(demoSeedPassword('development', undefined, undefined)).toBe(
      'password',
    );
    expect(demoSeedPassword('development', undefined, 'chosen')).toBe('chosen');
  });
});
