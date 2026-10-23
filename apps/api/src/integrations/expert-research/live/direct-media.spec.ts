import {
  isYouTubeUrl,
  looksLikeDirectMediaUrl,
  probeDirectMedia,
} from './direct-media';

describe('direct public media', () => {
  it('never treats a YouTube watch URL as transcribable media', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isYouTubeUrl('https://youtu.be/abc')).toBe(true);
    expect(
      looksLikeDirectMediaUrl('https://www.youtube.com/watch?v=abc.mp4'),
    ).toBe(false);
    expect(
      looksLikeDirectMediaUrl('https://podcast.example.edu/talk.mp3'),
    ).toBe(true);
  });

  it('skips YouTube on probe without submitting the URL', async () => {
    const fetchImpl = jest.fn() as typeof fetch;
    const probe = await probeDirectMedia(
      'https://www.youtube.com/watch?v=abc',
      { timeoutMs: 500, fetchImpl, maxMinutes: 30 },
    );
    expect(probe.acceptable).toBe(false);
    expect(probe.skipReason).toMatch(/cannot be transcribed automatically/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
