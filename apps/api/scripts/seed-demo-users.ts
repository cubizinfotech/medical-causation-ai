/**
 * Default accounts. Existing accounts are never changed. Refused in
 * production unless ALLOW_DEMO_SEED=true and DEMO_USER_PASSWORD is set
 * (any non-empty value, including "password").
 * Other people: npm run user:create.
 */
import { PrismaClient } from '@prisma/client';
import { demoSeedPassword } from '../src/platform/auth/demo-seed.policy';
import type { PlatformRole } from '../src/platform/users/user.types';
import { createUserIfMissing, ensureRoles, loadEnv } from './user-accounts';

const DEFAULT_USERS: Array<{
  email: string;
  displayName: string;
  role: PlatformRole;
}> = [
  {
    email: 'gopalhingu123@gmail.com',
    displayName: 'Gopal Hingu',
    role: 'attorney',
  },
  {
    email: 'dcs@dorothyclaysims.com',
    displayName: 'Dorothy Clay Sims',
    role: 'attorney',
  },
];

async function main(): Promise<void> {
  loadEnv();
  const password = demoSeedPassword();
  const prisma = new PrismaClient();
  try {
    await ensureRoles(prisma);
    for (const account of DEFAULT_USERS) {
      const created = await createUserIfMissing(prisma, {
        ...account,
        password,
      });
      console.log(
        `${created ? 'Created' : 'Kept existing'} ${account.email} (${account.role})`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Seed failed');
  process.exit(1);
});
