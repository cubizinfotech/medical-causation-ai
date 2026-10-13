import { RateLimitExceededException } from '../exceptions';
import {
  BACKGROUND_RATE_LIMIT_RETRY,
  retryOnRateLimit,
} from './retry-on-rate-limit.util';

describe('retryOnRateLimit', () => {
  it('waits the time the provider asks for, capped, and tries once more', async () => {
    const sleep = jest.fn(() => Promise.resolve());
    const call = jest
      .fn()
      .mockRejectedValueOnce(new RateLimitExceededException('groq', 60_000))
      .mockResolvedValueOnce('ok');
    await expect(retryOnRateLimit(call, { sleep })).resolves.toBe('ok');
    expect(sleep).toHaveBeenCalledWith(10_000);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('gives up after a second rate limit and passes other errors through', async () => {
    const sleep = () => Promise.resolve();
    const limited = jest
      .fn()
      .mockRejectedValue(new RateLimitExceededException('groq', 500));
    await expect(retryOnRateLimit(limited, { sleep })).rejects.toBeInstanceOf(
      RateLimitExceededException,
    );
    expect(limited).toHaveBeenCalledTimes(2);

    const broken = jest.fn().mockRejectedValue(new Error('bad request'));
    await expect(retryOnRateLimit(broken, { sleep })).rejects.toThrow(
      'bad request',
    );
    expect(broken).toHaveBeenCalledTimes(1);
  });

  it('in background jobs, waits up to a minute and tries three times', async () => {
    const sleep = jest.fn(() => Promise.resolve());
    const call = jest
      .fn()
      .mockRejectedValueOnce(new RateLimitExceededException('mistral', 20_000))
      .mockRejectedValueOnce(new RateLimitExceededException('mistral', 90_000))
      .mockResolvedValueOnce('ok');
    await expect(
      retryOnRateLimit(call, { ...BACKGROUND_RATE_LIMIT_RETRY, sleep }),
    ).resolves.toBe('ok');
    expect(sleep.mock.calls).toEqual([[20_000], [60_000]]);
    expect(call).toHaveBeenCalledTimes(3);
  });
});
