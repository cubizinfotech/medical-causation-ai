import { EXPERT_RESEARCH_CATALOG } from '../providers/provider-catalog';
import { applyIdentityMatch } from '../providers/identity-match';
import { parsePersonName } from './person-name';
import { fakeFetch, type FakeRoute } from './testing/live-fakes';
import { YoutubeClient } from './youtube.client';
import {
  buildYoutubeQuery,
  supportingEvidence,
  videoNamesMatch,
  YoutubeResearchProvider,
  YOUTUBE_TRANSCRIPT_UNAVAILABLE,
} from './youtube.provider';

const definition = EXPERT_RESEARCH_CATALOG.find(
  (entry) => entry.id === 'youtube',
);

const query = {
  expertName: 'Jane Smith',
  city: 'Phoenix, AZ',
  specialty: 'Neurology',
};

function searchRoute(
  items: Array<{
    videoId: string;
    title: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  }>,
): FakeRoute {
  return {
    match: (url) => url.pathname.endsWith('/search'),
    respond: () => ({
      items: items.map((item) => ({
        id: { videoId: item.videoId },
        snippet: {
          title: item.title,
          description: item.description ?? '',
          channelTitle: item.channelTitle ?? 'Lectures',
          channelId: 'UC1',
          publishedAt: item.publishedAt ?? '2024-03-01T00:00:00Z',
        },
      })),
    }),
  };
}

function videosRoute(
  items: Array<{
    videoId: string;
    title: string;
    description?: string;
    channelTitle?: string;
  }>,
): FakeRoute {
  return {
    match: (url) => url.pathname.endsWith('/videos'),
    respond: () => ({
      items: items.map((item) => ({
        id: item.videoId,
        snippet: {
          title: item.title,
          description: item.description ?? '',
          channelTitle: item.channelTitle ?? 'Lectures',
          channelId: 'UC1',
          publishedAt: '2024-03-01T00:00:00Z',
        },
        contentDetails: { duration: 'PT18M', caption: 'true' },
      })),
    }),
  };
}

function provider(routes: FakeRoute[], apiKey = 'test-youtube-key') {
  if (!definition) throw new Error('youtube catalog entry missing');
  const fake = fakeFetch(routes);
  return {
    provider: new YoutubeResearchProvider(
      definition,
      new YoutubeClient({
        apiKey,
        timeoutMs: 1000,
        fetchImpl: fake.fetch,
        maxResults: 5,
      }),
    ),
    calls: fake.calls,
  };
}

describe('YouTube name and evidence matching', () => {
  const name = parsePersonName('Jane Smith');
  if (!name) throw new Error('name');

  it('requires first and last name and does not keep a different first name', () => {
    expect(
      videoNamesMatch(
        {
          title: 'Jane Smith neurology grand rounds',
          description: '',
          channelTitle: 'Clinic',
        },
        name,
      ),
    ).toBe(true);
    expect(
      videoNamesMatch(
        {
          title: 'John Smith neurology lecture',
          description: '',
          channelTitle: 'Clinic',
        },
        name,
      ),
    ).toBe(false);
    expect(
      videoNamesMatch(
        {
          title: 'Grand rounds 2024',
          description: '',
          channelTitle: 'Dr. J. Smith MD',
        },
        name,
      ),
    ).toBe(true);
  });

  it('attributes only when specialty or place also appears', () => {
    expect(
      supportingEvidence(
        {
          title: 'Jane Smith neurology lecture',
          description: '',
          channelTitle: 'Clinic',
        },
        query,
      ),
    ).toMatch(/specialty/i);
    expect(
      supportingEvidence(
        {
          title: 'Jane Smith interview',
          description: 'Recorded in Phoenix',
          channelTitle: 'News',
        },
        query,
      ),
    ).toMatch(/place/i);
    expect(
      supportingEvidence(
        {
          title: 'Jane Smith family reunion',
          description: '',
          channelTitle: 'Home movies',
        },
        query,
      ),
    ).toBeNull();
  });

  it('quotes the expert name in the search query', () => {
    expect(buildYoutubeQuery(query, name)).toBe('"Jane Smith" Neurology');
  });
});

describe('YoutubeResearchProvider', () => {
  it('reports not configured without a key and does not call YouTube', async () => {
    if (!definition) throw new Error('youtube catalog entry missing');
    const result = await new YoutubeResearchProvider(definition, null).search(
      query,
    );
    expect(result.status).toBe('unavailable');
    expect(result.outcome).toBe('unavailable');
    expect(result.message).toMatch(/not configured \(no API key\)/i);
    expect(result.items).toEqual([]);
  });

  it('keeps source URLs, marks transcripts unavailable, and drops a similar name', async () => {
    const { provider: youtube, calls } = provider([
      searchRoute([
        {
          videoId: 'abc123XYZ00',
          title: 'Jane Smith neurology lecture',
          description: 'Board-certified neurologist in Phoenix',
          channelTitle: 'Grand Rounds',
        },
        {
          videoId: 'otherPerson1',
          title: 'John Smith neurology review',
          description: 'A different neurologist',
          channelTitle: 'CME',
        },
      ]),
      videosRoute([
        {
          videoId: 'abc123XYZ00',
          title: 'Jane Smith neurology lecture',
          description: 'Board-certified neurologist in Phoenix',
          channelTitle: 'Grand Rounds',
        },
        {
          videoId: 'otherPerson1',
          title: 'John Smith neurology review',
          description: 'A different neurologist',
          channelTitle: 'CME',
        },
      ]),
    ]);
    const result = await youtube.search(query);
    expect(result.status).toBe('ok');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.url).toBe(
      'https://www.youtube.com/watch?v=abc123XYZ00',
    );
    expect(result.items[0]?.raw?.transcriptAvailable).toBe(false);
    expect(result.items[0]?.raw?.captionAvailable).toBe(true);
    expect(String(result.items[0]?.raw?.transcriptUnavailableReason)).toMatch(
      /cannot be transcribed automatically/i,
    );
    expect(String(result.items[0]?.raw?.transcriptUnavailableReason)).toMatch(
      /lists captions/i,
    );
    expect(result.message).toMatch(/cannot be transcribed automatically/i);
    const matched = applyIdentityMatch(query, result.items);
    expect(matched[0]?.identityMatch).toBe('matched');
    expect(calls.some((call) => call.url.pathname.endsWith('/search'))).toBe(
      true,
    );
    expect(calls.some((call) => call.url.searchParams.has('key'))).toBe(true);
  });

  it('does not treat a name-only video as the expert', async () => {
    const { provider: youtube } = provider([
      searchRoute([
        {
          videoId: 'familyVid001',
          title: 'Jane Smith at the picnic',
          description: 'Family videos',
          channelTitle: 'Smith family',
        },
      ]),
      videosRoute([
        {
          videoId: 'familyVid001',
          title: 'Jane Smith at the picnic',
          description: 'Family videos',
          channelTitle: 'Smith family',
        },
      ]),
    ]);
    const result = await youtube.search(query);
    expect(result.status).toBe('ok');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.summary).toMatch(/not treated as a video/i);
    const matched = applyIdentityMatch(query, result.items);
    expect(matched[0]?.identityMatch).toBe('uncertain');
  });

  it('maps HTTP 403 to a rate-limit outcome without inventing videos', async () => {
    const { provider: youtube } = provider([
      {
        match: (url) => url.pathname.endsWith('/search'),
        status: 403,
        respond: () => ({
          error: { code: 403, errors: [{ reason: 'quotaExceeded' }] },
        }),
      },
    ]);
    const result = await youtube.search(query);
    expect(result.status).toBe('error');
    expect(result.outcome).toBe('rate_limited');
    expect(result.items).toEqual([]);
    expect(result.message).toMatch(/quota|YouTube rejected/i);
  });
});
