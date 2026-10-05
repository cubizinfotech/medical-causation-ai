/**
 * Demo accounts stay off production unless ALLOW_DEMO_SEED=true.
 * The seed upserts by email and stores only password hashes.
 */
export function assertDemoSeedAllowed(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  allowOverride: string | undefined = process.env.ALLOW_DEMO_SEED,
): void {
  if (nodeEnv === 'production' && allowOverride !== 'true') {
    throw new Error(
      'Demo user seed is refused in production. Set ALLOW_DEMO_SEED=true to create the configured accounts.',
    );
  }
}
