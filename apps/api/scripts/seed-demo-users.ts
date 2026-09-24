/**
 * Local demo accounts. Refuses to run when NODE_ENV=production.
 * Passwords are hashed before they are stored.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { assertDemoSeedAllowed } from '../src/platform/auth/demo-seed.policy';
import { hashPassword } from '../src/platform/auth/password';
import {
  PLATFORM_ROLES,
  type PlatformRole,
} from '../src/platform/users/user.types';

const DEMO_PASSWORD = 'password';

const DEMO_USERS: Array<{
  email: string;
  displayName: string;
  role: PlatformRole;
}> = [
  {
    email: 'super-admin@example.com',
    displayName: 'Super Admin',
    role: 'super_admin',
  },
  { email: 'admin@example.com', displayName: 'Admin', role: 'admin' },
  { email: 'attorney@example.com', displayName: 'Attorney', role: 'attorney' },
  {
    email: 'paralegal@example.com',
    displayName: 'Paralegal',
    role: 'paralegal',
  },
  {
    email: 'medical-expert@example.com',
    displayName: 'Medical Expert',
    role: 'medical_expert',
  },
  {
    email: 'normal-user@example.com',
    displayName: 'Normal User',
    role: 'user',
  },
];

async function main(): Promise<void> {
  assertDemoSeedAllowed();
  const apiDir = resolve(__dirname, '..');
  config({ path: resolve(apiDir, '../../.env') });
  config({ path: resolve(apiDir, '.env'), override: false });
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    for (const role of PLATFORM_ROLES) {
      await prisma.role.upsert({
        where: { name: role },
        update: {},
        create: { name: role },
      });
    }
    for (const account of DEMO_USERS) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { name: account.role },
      });
      const user = await prisma.user.upsert({
        where: { email: account.email },
        update: {
          displayName: account.displayName,
          passwordHash,
        },
        create: {
          email: account.email,
          displayName: account.displayName,
          passwordHash,
        },
      });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      console.log(`Seeded ${account.email} (${account.role})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Seed failed';
  console.error(message);
  process.exit(1);
});
