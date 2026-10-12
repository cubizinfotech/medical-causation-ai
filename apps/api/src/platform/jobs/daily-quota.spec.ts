import { HttpException } from '@nestjs/common';
import { assertDailyJobQuota } from './daily-quota';

describe('assertDailyJobQuota', () => {
  const prisma = (analyses: number, investigations: number) =>
    ({
      analysisCase: { count: jest.fn().mockResolvedValue(analyses) },
      investigation: { count: jest.fn().mockResolvedValue(investigations) },
    }) as never;

  it('counts both products together', async () => {
    await expect(
      assertDailyJobQuota(prisma(3, 2), 'user-1', 5),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      assertDailyJobQuota(prisma(3, 1), 'user-1', 5),
    ).resolves.toBeUndefined();
  });

  it('is off when the limit is 0', async () => {
    await expect(
      assertDailyJobQuota(prisma(999, 999), 'user-1', 0),
    ).resolves.toBeUndefined();
  });
});
