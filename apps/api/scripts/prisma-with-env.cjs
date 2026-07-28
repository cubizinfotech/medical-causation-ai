/**
 * Loads the monorepo root .env before running Prisma CLI commands.
 * Prisma only auto-loads .env next to schema.prisma; our .env lives at repo root.
 */
const { config } = require('dotenv');
const { resolve } = require('path');
const { execSync } = require('child_process');

const apiDir = resolve(__dirname, '..');
const rootEnv = resolve(apiDir, '../../.env');
const localEnv = resolve(apiDir, '.env');

config({ path: rootEnv });
config({ path: localEnv, override: false });

const prismaArgs = process.argv.slice(2).join(' ');
if (!prismaArgs) {
  console.error('Usage: node scripts/prisma-with-env.cjs <prisma-args>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to the repo root .env and configure PostgreSQL.',
  );
  process.exit(1);
}

execSync(`npx prisma ${prismaArgs}`, {
  stdio: 'inherit',
  env: process.env,
  cwd: apiDir,
});
