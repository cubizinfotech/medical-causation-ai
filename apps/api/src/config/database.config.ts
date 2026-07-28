import type { DatabaseSettings } from './config.types';

export const databaseConfig = (): DatabaseSettings => {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = Number(process.env.POSTGRES_PORT ?? 5432);
  const user = process.env.POSTGRES_USER ?? 'mca_user';
  const password = process.env.POSTGRES_PASSWORD ?? 'mca_password';
  const name = process.env.POSTGRES_DB ?? 'medical_causation_ai';

  return {
    url:
      process.env.DATABASE_URL ??
      `postgresql://${user}:${password}@${host}:${port}/${name}`,
    host,
    port,
    user,
    password,
    name,
    ssl: process.env.DATABASE_SSL === 'true',
    poolMin: Number(process.env.DATABASE_POOL_MIN ?? 2),
    poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  };
};
