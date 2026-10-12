/**
 * Shared helpers for the account scripts (seed-demo-users, create-user).
 * Passwords are hashed before they are stored.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/platform/auth/password';
import {
  PLATFORM_ROLES,
  type PlatformRole,
} from '../src/platform/users/user.types';

export function loadEnv(): void {
  const apiDir = resolve(__dirname, '..');
  config({ path: resolve(apiDir, '../../.env') });
  config({ path: resolve(apiDir, '.env'), override: false });
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }
}

export async function ensureRoles(prisma: PrismaClient): Promise<void> {
  for (const role of PLATFORM_ROLES) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
  }
}

/**
 * Creates the account when the email is new. An existing account is left
 * exactly as it is (password and role included); returns false then.
 */
export async function createUserIfMissing(
  prisma: PrismaClient,
  account: {
    email: string;
    displayName: string;
    role: PlatformRole;
    password: string;
  },
): Promise<boolean> {
  const email = account.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return false;
  const role = await prisma.role.findUniqueOrThrow({
    where: { name: account.role },
  });
  await prisma.user.create({
    data: {
      email,
      displayName: account.displayName,
      passwordHash: await hashPassword(account.password),
      roles: { create: { roleId: role.id } },
    },
  });
  return true;
}

export function isPlatformRole(value: string): value is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(value);
}
