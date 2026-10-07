import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  PLATFORM_ROLES,
  type IUserService,
  type PlatformRole,
  type PlatformUser,
  type ProfileDetailsInput,
} from './user.types';
import type { AvatarImage } from './avatar';

// The photo bytes are only read by getAvatar(). Every other query skips them,
// because findById runs on each authenticated request.
const WITHOUT_AVATAR = { avatarData: true } as const;
const WITH_ROLES = { roles: { include: { role: true } } } as const;

@Injectable()
export class UsersService implements IUserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PlatformUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: WITH_ROLES,
      omit: WITHOUT_AVATAR,
    });
    return row ? toPlatformUser(row) : null;
  }

  async findByEmail(
    email: string,
  ): Promise<(PlatformUser & { passwordHash: string }) | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: WITH_ROLES,
      omit: WITHOUT_AVATAR,
    });
    if (!row) return null;
    return { ...toPlatformUser(row), passwordHash: row.passwordHash };
  }

  async list(): Promise<PlatformUser[]> {
    const rows = await this.prisma.user.findMany({
      include: WITH_ROLES,
      omit: WITHOUT_AVATAR,
      orderBy: { email: 'asc' },
    });
    return rows.map(toPlatformUser);
  }

  async updateProfile(
    id: string,
    input: ProfileDetailsInput,
  ): Promise<PlatformUser> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        displayName: input.displayName,
        jobTitle: input.jobTitle,
        organization: input.organization,
        phone: input.phone,
        location: input.location,
        bio: input.bio,
      },
      include: WITH_ROLES,
      omit: WITHOUT_AVATAR,
    });
    return toPlatformUser(row);
  }

  async setAvatar(id: string, image: AvatarImage): Promise<PlatformUser> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        avatarData: new Uint8Array(image.data),
        avatarMimeType: image.mimeType,
        avatarUpdatedAt: new Date(),
      },
      include: WITH_ROLES,
      omit: WITHOUT_AVATAR,
    });
    return toPlatformUser(row);
  }

  async clearAvatar(id: string): Promise<PlatformUser> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { avatarData: null, avatarMimeType: null, avatarUpdatedAt: null },
      include: WITH_ROLES,
      omit: WITHOUT_AVATAR,
    });
    return toPlatformUser(row);
  }

  async getAvatar(id: string): Promise<AvatarImage> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { avatarData: true, avatarMimeType: true },
    });
    if (!row?.avatarData || !row.avatarMimeType) {
      throw new NotFoundException('No profile photo');
    }
    return { data: Buffer.from(row.avatarData), mimeType: row.avatarMimeType };
  }
}

function toPlatformUser(row: {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  organization: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  avatarUpdatedAt: Date | null;
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
    jobTitle: row.jobTitle,
    organization: row.organization,
    phone: row.phone,
    location: row.location,
    bio: row.bio,
    avatarUpdatedAt: row.avatarUpdatedAt?.toISOString() ?? null,
  };
}

function permissionsFor(roles: PlatformRole[]): string[] {
  const permissions = new Set<string>(['mca:*', 'ewi:*']);
  if (roles.includes('super_admin') || roles.includes('admin')) {
    permissions.add('platform:users:read');
  }
  return [...permissions];
}
