import { describeError, redactSecrets } from './redact-secrets.util';
import { sameEmbeddingModel } from './embedding-model.util';

describe('redactSecrets', () => {
  const saved = process.env.TEST_PROVIDER_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.TEST_PROVIDER_API_KEY;
    else process.env.TEST_PROVIDER_API_KEY = saved;
  });

  it('removes key formats, bearer tokens, and key query parameters', () => {
    const text = redactSecrets(
      'AIzaSyAbcdefghijklmnopqrstuvwxyz0123456 sk-abcdefghijklmnopqrstu gsk_abcdefghijklmnopqrstu Bearer abc.def.ghijklmnop ?key=secretvalue&x=1',
    );
    expect(text).not.toMatch(/AIzaSy|sk-abc|gsk_abc|abc\.def|secretvalue/);
    expect(text).toContain('Bearer [redacted]');
    expect(text).toContain('?key=[redacted]&x=1');
  });

  it('removes configured secret values of any format', () => {
    process.env.TEST_PROVIDER_API_KEY = 'plain-configured-secret-123';
    expect(redactSecrets('failed with plain-configured-secret-123')).toBe(
      'failed with [redacted]',
    );
  });

  it('describes errors briefly and without secrets', () => {
    const long = `boom AIzaSyAbcdefghijklmnopqrstuvwxyz0123456 ${'x'.repeat(500)}`;
    const described = describeError(new Error(long), 50);
    expect(described).not.toContain('AIzaSy');
    expect(described.length).toBeLessThanOrEqual(51);
  });
});

describe('sameEmbeddingModel', () => {
  it('matches a model with or without its vendor prefix', () => {
    expect(
      sameEmbeddingModel(
        'openai/text-embedding-3-small',
        'text-embedding-3-small',
      ),
    ).toBe(true);
    expect(
      sameEmbeddingModel('models/gemini-embedding-2', 'gemini-embedding-2'),
    ).toBe(true);
    expect(
      sameEmbeddingModel('gemini-embedding-001', 'gemini-embedding-2'),
    ).toBe(false);
    expect(sameEmbeddingModel('', '')).toBe(false);
  });
});
