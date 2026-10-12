import { HttpException, HttpStatus } from '@nestjs/common';
import type { PrismaService } from '@database/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Caps the paid AI work one user can start: MCA analyses plus EWI
 * investigations created in the last 24 hours. A limit of 0 turns it off.
 */
export async function assertDailyJobQuota(
  prisma: Pick<PrismaService, 'analysisCase' | 'investigation'>,
  ownerUserId: string,
  limit: number,
): Promise<void> {
  if (limit <= 0) return;
  const since = new Date(Date.now() - DAY_MS);
  const [analyses, investigations] = await Promise.all([
    prisma.analysisCase.count({
      where: { ownerUserId, createdAt: { gte: since } },
    }),
    prisma.investigation.count({
      where: { ownerUserId, createdAt: { gte: since } },
    }),
  ]);
  if (analyses + investigations >= limit) {
    throw new HttpException(
      `You have reached the limit of ${limit} analyses and investigations in 24 hours. Try again later.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
