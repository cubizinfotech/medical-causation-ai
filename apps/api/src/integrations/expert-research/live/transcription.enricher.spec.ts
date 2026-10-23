import { MediaTranscriptionEnricher } from './transcription.enricher';
import { AssemblyAiClient } from './assemblyai.client';
import type { ExpertResearchSourceResult } from '../expert-research.types';

function resultWith(
  url: string,
  extra: Record<string, unknown> = {},
): ExpertResearchSourceResult {
  return {
    sourceId: 'presentations',
    status: 'ok',
    outcome: 'success',
    access: 'public',
    retrievedAt: '2026-10-23T00:00:00.000Z',
    items: [
      {
        sourceId: 'presentations',
        category: 'video',
        title: 'Grand rounds audio',
        summary: 'University mp3',
        url,
        access: 'public',
        informationStatus: 'unverified',
        raw: { presenceKind: 'video', ...extra },
      },
    ],
  };
}

describe('MediaTranscriptionEnricher', () => {
  it('does not submit YouTube URLs and keeps the video row', async () => {
    const transcribeUrl = jest.fn();
    const enricher = new MediaTranscriptionEnricher(
      {
        enabled: true,
        apiKey: 'test',
        maxFiles: 2,
        maxMinutes: 30,
        timeoutMs: 1000,
      },
      { transcribeUrl } as unknown as AssemblyAiClient,
    );
    const [out] = await enricher.enrich([
      resultWith('https://www.youtube.com/watch?v=abc123'),
    ]);
    expect(transcribeUrl).not.toHaveBeenCalled();
    expect(out?.items[0]?.url).toContain('youtube.com');
    expect(out?.items[0]?.raw?.transcriptAvailable).toBe(false);
    expect(String(out?.items[0]?.raw?.transcriptUnavailableReason)).toMatch(
      /cannot be transcribed automatically/i,
    );
  });

  it('caps at two files and skips a duplicate URL', async () => {
    const transcribeUrl = jest.fn((url: string) =>
      Promise.resolve({
        id: url,
        text: `Transcript of ${url}`,
        words: [{ text: 'Hello', start: 0, end: 400 }],
        audioDuration: 12,
      }),
    );
    const fetchImpl = jest.fn(() =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: {
            'content-type': 'audio/mpeg',
            'content-length': '12000',
          },
        }),
      ),
    ) as typeof fetch;
    const enricher = new MediaTranscriptionEnricher(
      {
        enabled: true,
        apiKey: 'test',
        maxFiles: 2,
        maxMinutes: 30,
        timeoutMs: 1000,
        fetchImpl,
      },
      { transcribeUrl } as unknown as AssemblyAiClient,
    );
    const duplicated = resultWith('https://media.example.edu/a.mp3');
    const first = duplicated.items[0];
    if (first) {
      duplicated.items.push({
        ...first,
        title: 'Same file again',
      });
    }
    const third = resultWith('https://media.example.edu/b.mp3');
    const fourth = resultWith('https://media.example.edu/c.mp3');
    const out = await enricher.enrich([duplicated, third, fourth]);
    expect(transcribeUrl).toHaveBeenCalledTimes(2);
    expect(out[0]?.items[0]?.raw?.transcript).toMatch(/Transcript of/);
    expect(out[0]?.items[1]?.raw?.transcript).toBeUndefined();
    expect(out[2]?.items[0]?.raw?.transcript).toBeUndefined();
  });
});
