/** Demo accounts are local only. Production must never receive these users. */
export function assertDemoSeedAllowed(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (nodeEnv === 'production') {
    throw new Error('Demo user seed is refused in production.');
  }
}
