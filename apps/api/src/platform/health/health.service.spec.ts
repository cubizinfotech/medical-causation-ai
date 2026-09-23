import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports liveness without dependency details', () => {
    const service = new HealthService(
      { $queryRaw: jest.fn() } as never,
      { getClient: () => ({ ping: jest.fn() }) } as never,
    );
    const live = service.liveness();
    expect(live.status).toBe('ok');
    expect(live).not.toHaveProperty('database');
  });

  it('marks readiness degraded when redis is down', async () => {
    const service = new HealthService(
      { $queryRaw: jest.fn().mockResolvedValue([1]) } as never,
      {
        getClient: () => ({
          ping: jest.fn().mockRejectedValue(new Error('connection refused')),
        }),
      } as never,
    );

    const report = await service.readiness();
    expect(report.status).toBe('degraded');
    expect(report.checks.database.status).toBe('up');
    expect(report.checks.redis.status).toBe('down');
    expect(report.checks.redis.error).toBe('unavailable');
  });
});
