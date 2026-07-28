import { configuration } from './configuration';
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { redisConfig } from './redis.config';
import { aiConfig } from './ai.config';

describe('Configuration', () => {
  it('should return a complete root configuration object', () => {
    const config = configuration();

    expect(config.app).toBeDefined();
    expect(config.database).toBeDefined();
    expect(config.redis).toBeDefined();
    expect(config.ai).toBeDefined();
    expect(config.storage).toBeDefined();
    expect(config.logging).toBeDefined();
    expect(config.features).toBeDefined();
  });

  it('should use default app port', () => {
    const config = appConfig();
    expect(config.port).toBe(3001);
  });

  it('should build database URL from components', () => {
    const config = databaseConfig();
    expect(config.url).toContain('postgresql://');
    expect(config.host).toBe('localhost');
  });

  it('should build redis URL from components', () => {
    const config = redisConfig();
    expect(config.url).toContain('redis://');
    expect(config.keyPrefix).toBe('mca:');
  });

  it('should default AI provider to openrouter', () => {
    const config = aiConfig();
    expect(config.activeProvider).toBe('openrouter');
  });

  it('should include embedding configuration', () => {
    const config = configuration();
    expect(config.embedding).toBeDefined();
    expect(config.prompt).toBeDefined();
    expect(config.token).toBeDefined();
  });
});
