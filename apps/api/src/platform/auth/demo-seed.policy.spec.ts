import { assertDemoSeedAllowed } from './demo-seed.policy';

describe('demo seed policy', () => {
  it('refuses to seed demo users in production', () => {
    expect(() => assertDemoSeedAllowed('production')).toThrow(/production/);
  });

  it('allows the seed outside production', () => {
    expect(() => assertDemoSeedAllowed('development')).not.toThrow();
    expect(() => assertDemoSeedAllowed(undefined)).not.toThrow();
  });
});
