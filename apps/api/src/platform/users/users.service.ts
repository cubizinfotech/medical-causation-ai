import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  PLATFORM_ROLES,
  type IUserService,
  type PlatformRole,
  type PlatformUser,
} from './user.types';

@Injectable()
export class UsersService implements IUserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PlatformUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    return row ? toPlatformUser(row) : null;
  }

  async findByEmail(
    email: string,
  ): Promise<(PlatformUser & { passwordHash: string }) | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    if (!row) return null;
    return { ...toPlatformUser(row), passwordHash: row.passwordHash };
  }

  async list(): Promise<PlatformUser[]> {
    const rows = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { email: 'asc' },
    });
    return rows.map(toPlatformUser);
  }
}

function toPlatformUser(row: {
  id: string;
  email: string;
  displayName: string;
  roles: Array<{ role: { name: string } }>;
}): PlatformUser {
  const roles = row.roles
    .map((entry) => entry.role.name)
    .filter((name): name is PlatformRole =>
      (PLATFORM_ROLES as readonly string[]).includes(name),
    );
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    roles,
    permissions: permissionsFor(roles),
  };
}

function permissionsFor(roles: PlatformRole[]): string[] {
  const permissions = new Set<string>(['mca:*', 'ewi:*']);
  if (roles.includes('super_admin') || roles.includes('admin')) {
    permissions.add('platform:users:read');
  }
  return [...permissions];
}
