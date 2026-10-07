import { NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const user = {
    id: 'user-1',
    email: 'attorney@example.com',
    displayName: 'Attorney',
    roles: ['attorney'],
    permissions: ['mca:*', 'ewi:*'],
  };

  function build(overrides: { user?: unknown } = {}) {
    const prisma = {
      user: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-02-01T00:00:00Z'),
          }),
        ),
      },
      analysisCase: {
        groupBy: jest.fn(() =>
          Promise.resolve([
            {
              status: 'completed',
              _count: { _all: 3 },
              _max: { createdAt: new Date('2026-03-01T00:00:00Z') },
            },
            {
              status: 'failed',
              _count: { _all: 1 },
              _max: { createdAt: new Date('2026-03-05T00:00:00Z') },
            },
          ]),
        ),
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              id: 'case-1',
              accidentType: 'Motor Vehicle Collision',
              diagnosis: 'Concussion',
              status: 'completed',
              createdAt: new Date('2026-03-05T00:00:00Z'),
            },
          ]),
        ),
      },
      investigation: {
        groupBy: jest.fn(() => Promise.resolve([])),
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              id: 'inv-1',
              status: 'completed',
              createdAt: new Date('2026-03-10T00:00:00Z'),
              expert: {
                name: 'Jane Doe',
                city: 'Boston',
                specialty: 'Neurology',
              },
            },
          ]),
        ),
      },
    };
    const users = {
      findById: jest.fn(() =>
        Promise.resolve('user' in overrides ? overrides.user : user),
      ),
    };
    return {
      service: new ProfileService(prisma as never, users as never),
      prisma,
    };
  }

  it('summarizes activity and merges recent items newest first', async () => {
    const { service, prisma } = build();
    const profile = await service.getProfile('user-1');

    expect(profile.email).toBe('attorney@example.com');
    expect(profile.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(profile.activity.mca).toEqual({
      total: 4,
      byStatus: { completed: 3, failed: 1 },
      lastActivityAt: '2026-03-05T00:00:00.000Z',
    });
    expect(profile.activity.ewi).toEqual({
      total: 0,
      byStatus: {},
      lastActivityAt: null,
    });
    expect(profile.recent.map((item) => item.id)).toEqual(['inv-1', 'case-1']);
    expect(prisma.analysisCase.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: 'user-1' } }),
    );
    expect(prisma.investigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: 'user-1' } }),
    );
  });

  it('throws when the user no longer exists', async () => {
    const { service } = build({ user: null });
    await expect(service.getProfile('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
