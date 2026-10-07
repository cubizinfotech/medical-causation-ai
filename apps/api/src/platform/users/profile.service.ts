import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { UsersService } from './users.service';
import type { PlatformUser } from './user.types';

const RECENT_LIMIT = 6;

export interface ProductActivity {
  total: number;
  byStatus: Record<string, number>;
  lastActivityAt: string | null;
}

export interface RecentActivityItem {
  product: 'mca' | 'ewi';
  id: string;
  title: string;
  subtitle: string;
  status: string;
  createdAt: string;
}

export interface UserProfile extends PlatformUser {
  createdAt: string;
  updatedAt: string;
  activity: { mca: ProductActivity; ewi: ProductActivity };
  recent: RecentActivityItem[];
}

/**
 * Read-only account summary for the signed-in user. Counts only the
 * caller's own MCA cases and EWI investigations (owner_user_id).
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const [user, account, mcaGroups, ewiGroups, mcaRecent, ewiRecent] =
      await Promise.all([
        this.users.findById(userId),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { createdAt: true, updatedAt: true },
        }),
        this.prisma.analysisCase.groupBy({
          by: ['status'],
          where: { ownerUserId: userId },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        this.prisma.investigation.groupBy({
          by: ['status'],
          where: { ownerUserId: userId },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        this.prisma.analysisCase.findMany({
          where: { ownerUserId: userId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_LIMIT,
          select: {
            id: true,
            accidentType: true,
            diagnosis: true,
            status: true,
            createdAt: true,
          },
        }),
        this.prisma.investigation.findMany({
          where: { ownerUserId: userId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_LIMIT,
          select: {
            id: true,
            status: true,
            createdAt: true,
            expert: { select: { name: true, city: true, specialty: true } },
          },
        }),
      ]);

    if (!user || !account) {
      throw new NotFoundException('User not found');
    }

    const recent: RecentActivityItem[] = [
      ...mcaRecent.map((row) => ({
        product: 'mca' as const,
        id: row.id,
        title: row.diagnosis,
        subtitle: row.accidentType,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      ...ewiRecent.map((row) => ({
        product: 'ewi' as const,
        id: row.id,
        title: row.expert.name,
        subtitle: `${row.expert.city} · ${row.expert.specialty}`,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, RECENT_LIMIT);

    return {
      ...user,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      activity: { mca: summarize(mcaGroups), ewi: summarize(ewiGroups) },
      recent,
    };
  }
}

function summarize(
  groups: Array<{
    status: string;
    _count: { _all: number };
    _max: { createdAt: Date | null };
  }>,
): ProductActivity {
  const byStatus: Record<string, number> = {};
  let total = 0;
  let last: Date | null = null;
  for (const group of groups) {
    byStatus[group.status] = group._count._all;
    total += group._count._all;
    const max = group._max.createdAt;
    if (max && (!last || max > last)) last = max;
  }
  return { total, byStatus, lastActivityAt: last?.toISOString() ?? null };
}
