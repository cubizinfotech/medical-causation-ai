/**
 * Creates one real account.
 *
 *   npm run user:create -- <email> <role> "<Display Name>"
 *
 * Roles: super_admin, admin, attorney, paralegal, medical_expert, user.
 * The password comes from NEW_USER_PASSWORD; without it a random one is
 * generated and printed once. An existing email is left unchanged.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { MIN_PRODUCTION_PASSWORD_LENGTH } from '../src/platform/auth/demo-seed.policy';
import {
  createUserIfMissing,
  ensureRoles,
  isPlatformRole,
  loadEnv,
} from './user-accounts';

async function main(): Promise<void> {
  const [email, role, ...nameParts] = process.argv.slice(2);
  if (!email?.includes('@') || !role || !isPlatformRole(role)) {
    throw new Error(
      'Usage: npm run user:create -- <email> <role> "<Display Name>"',
    );
  }
  loadEnv();
  const supplied = process.env.NEW_USER_PASSWORD;
  if (supplied && supplied.length < MIN_PRODUCTION_PASSWORD_LENGTH) {
    throw new Error(
      `NEW_USER_PASSWORD must be at least ${MIN_PRODUCTION_PASSWORD_LENGTH} characters.`,
    );
  }
  const password = supplied || randomBytes(12).toString('base64url');
  const prisma = new PrismaClient();
  try {
    await ensureRoles(prisma);
    const created = await createUserIfMissing(prisma, {
      email,
      role,
      displayName: nameParts.join(' ').trim() || email,
      password,
    });
    if (!created) {
      console.log(`${email} already exists. Nothing was changed.`);
      return;
    }
    console.log(`Created ${email} (${role}).`);
    if (!supplied) console.log(`Password (shown once): ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Create user failed');
  process.exit(1);
});
