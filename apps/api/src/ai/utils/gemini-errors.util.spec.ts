import { classifyGeminiError } from './gemini-errors.util';

/** Shaped like the ApiError @google/genai throws (status + JSON body). */
function apiError(status: number, body: object): Error {
  const error = new Error(JSON.stringify(body)) as Error & { status: number };
  error.name = 'ApiError';
  error.status = status;
  return error;
}

describe('classifyGeminiError', () => {
  it('stops on a bad key (400 API_KEY_INVALID) without retrying', () => {
    const info = classifyGeminiError(
      apiError(400, {
        error: {
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'INVALID_ARGUMENT',
          details: [{ reason: 'API_KEY_INVALID' }],
        },
      }),
    );
    expect(info).toMatchObject({ kind: 'auth', status: 400, retryable: false });
    expect(info.detail).toBe('API key not valid. Please pass a valid API key.');
  });

  it('stops on an unknown model (404)', () => {
    expect(
      classifyGeminiError(
        apiError(404, {
          error: { code: 404, message: 'models/x is not found' },
        }),
      ),
    ).toMatchObject({ kind: 'not_found', retryable: false });
  });

  it('retries a per-minute rate limit after the delay Google asks for', () => {
    expect(
      classifyGeminiError(
        apiError(429, {
          error: {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: 'Quota exceeded for metric: ...PerMinute',
            details: [{ retryDelay: '31s' }],
          },
        }),
      ),
    ).toMatchObject({
      kind: 'rate_limit',
      retryable: true,
      retryAfterMs: 31000,
    });
  });

  it('does not retry an exhausted daily quota', () => {
    expect(
      classifyGeminiError(
        apiError(429, {
          error: {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: 'Quota exceeded for quota metric GenerateRequestsPerDay',
          },
        }),
      ),
    ).toMatchObject({ kind: 'quota', retryable: false });
  });

  it('retries overload, network drops, and timeouts', () => {
    expect(
      classifyGeminiError(apiError(503, { error: { code: 503 } })),
    ).toMatchObject({ kind: 'server', retryable: true });
    expect(classifyGeminiError(new Error('fetch failed'))).toMatchObject({
      kind: 'network',
      retryable: true,
    });
    const abort = new Error('This operation was aborted');
    abort.name = 'AbortError';
    expect(classifyGeminiError(abort)).toMatchObject({
      kind: 'timeout',
      retryable: true,
    });
  });

  it('never puts a key in the detail', () => {
    const info = classifyGeminiError(
      new Error(
        'request to ...?key=AIzaSyAbcdefghijklmnopqrstuvwxyz0123456 failed',
      ),
    );
    expect(info.detail).not.toContain('AIzaSy');
  });
});
