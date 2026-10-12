/** Shortest password the account scripts accept on a production server. */
export const MIN_PRODUCTION_PASSWORD_LENGTH = 12;

/**
 * Demo accounts stay off production unless ALLOW_DEMO_SEED=true, and there
 * they need a real DEMO_USER_PASSWORD. Locally the password defaults to
 * "password" so the demo guide works out of the box.
 */
export function demoSeedPassword(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  allowOverride: string | undefined = process.env.ALLOW_DEMO_SEED,
  configured: string | undefined = process.env.DEMO_USER_PASSWORD,
): string {
  if (nodeEnv !== 'production') return configured || 'password';
  if (allowOverride !== 'true') {
    throw new Error(
      'Demo user seed is refused in production. Set ALLOW_DEMO_SEED=true to create the demo accounts.',
    );
  }
  if (!configured || configured.length < MIN_PRODUCTION_PASSWORD_LENGTH) {
    throw new Error(
      `Set DEMO_USER_PASSWORD (at least ${MIN_PRODUCTION_PASSWORD_LENGTH} characters) to seed demo accounts in production.`,
    );
  }
  return configured;
}
