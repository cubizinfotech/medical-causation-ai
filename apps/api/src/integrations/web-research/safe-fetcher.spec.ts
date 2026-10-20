/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-base-to-string -- test doubles */
import { SafeFetcher, isPrivateAddress } from './safe-fetcher';

const PUBLIC = async () => [{ address: '93.184.216.34' }];

const ARTICLE = `<html><head><title>Court report</title></head><body><article>
<p>Dr. Jason A. Demery, a neuropsychologist from Gainesville, testified for the defense on Tuesday.</p>
<p>The judge later ruled that the defendant is competent to stand trial after hearing from both experts.</p>
</article></body></html>`;

type Route = (url: string) => Response | undefined;

function fakeFetch(route: Route) {
  const calls: string[] = [];
  const impl = ((input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const response = route(url);
    if (response) return Promise.resolve(response);
    return Promise.resolve(new Response('not found', { status: 404 }));
  }) as typeof fetch;
  return { impl, calls };
}

const html = (
  body: string,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });

const robots = (body: string) =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('treats %s as private', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111'])(
    'treats %s as public',
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});

describe('SafeFetcher', () => {
  it('reads a public page and returns its text, title and date', async () => {
    const fake = fakeFetch((url) => {
      if (url.endsWith('/robots.txt')) return robots('User-agent: *\nAllow: /');
      return html(
        ARTICLE.replace(
          '<title>',
          '<meta property="article:published_time" content="2026-09-02"><title>',
        ),
      );
    });
    const page = await new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
    }).fetchPage('https://news.example/story');
    expect(page.status).toBe('read');
    expect(page.text).toContain('Dr. Jason A. Demery');
    expect(page.title).toBe('Court report');
    expect(page.publishedAt).toBe('2026-09-02');
  });

  it('never fetches a page that resolves to a private address', async () => {
    const fake = fakeFetch(() => html(ARTICLE));
    const page = await new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: async () => [{ address: '10.0.0.5' }],
    }).fetchPage('https://internal-looking.example/admin');
    expect(page.status).toBe('failed');
    expect(page.note).toMatch(/internal addresses/i);
    expect(fake.calls).toHaveLength(0);
  });

  it('refuses localhost, literal private IPs and non-web schemes', async () => {
    const fake = fakeFetch(() => html(ARTICLE));
    const fetcher = new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
    });
    expect((await fetcher.fetchPage('http://localhost:3000/')).status).toBe(
      'failed',
    );
    expect(
      (await fetcher.fetchPage('http://169.254.169.254/latest/meta-data'))
        .status,
    ).toBe('failed');
    expect((await fetcher.fetchPage('file:///etc/passwd')).status).toBe(
      'failed',
    );
    expect((await fetcher.fetchPage('not a url')).status).toBe('failed');
    expect(fake.calls).toHaveLength(0);
  });

  it('stops a redirect that points at a private address', async () => {
    const fake = fakeFetch((url) => {
      if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/secret' },
      });
    });
    const page = await new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
    }).fetchPage('https://short.example/x');
    expect(page.status).toBe('failed');
    expect(fake.calls.some((url) => url.includes('127.0.0.1'))).toBe(false);
  });

  it('never opens a signed-in-only social site', async () => {
    const fake = fakeFetch(() => html(ARTICLE));
    const page = await new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
    }).fetchPage('https://www.facebook.com/some.profile');
    expect(page.status).toBe('restricted');
    expect(page.note).toMatch(/no login was attempted/i);
    expect(fake.calls).toHaveLength(0);
  });

  it('respects robots.txt', async () => {
    const fake = fakeFetch((url) => {
      if (url.endsWith('/robots.txt'))
        return robots('User-agent: *\nDisallow: /private');
      return html(ARTICLE);
    });
    const fetcher = new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
    });
    const blocked = await fetcher.fetchPage(
      'https://site.example/private/profile',
    );
    expect(blocked.status).toBe('restricted');
    expect(blocked.note).toMatch(/robots\.txt/);
    expect(fake.calls).not.toContain('https://site.example/private/profile');
    expect(
      (await fetcher.fetchPage('https://site.example/public/profile')).status,
    ).toBe('read');
  });

  it('reports a bot-protection page instead of working around it', async () => {
    const fake = fakeFetch((url) => {
      if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
      return html(
        '<html><title>Just a moment...</title><body>Checking your browser</body></html>',
        403,
        {
          'cf-mitigated': 'challenge',
        },
      );
    });
    const page = await new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
      archiveFallback: false,
    }).fetchPage('https://protected.example/story');
    expect(page.status).toBe('restricted');
    expect(page.botBlocked).toBe(true);
    expect(page.note).toMatch(/not bypassed/i);
    expect(page.text).toBeUndefined();
  });

  it('reads the labelled Internet Archive copy when the publisher blocks bots', async () => {
    const fake = fakeFetch((url) => {
      if (url.startsWith('https://archive.org/wayback/available')) {
        return new Response(
          JSON.stringify({
            archived_snapshots: {
              closest: {
                available: true,
                status: '200',
                timestamp: '20260903120000',
                url: 'http://web.archive.org/web/20260903120000/https://protected.example/story',
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('web.archive.org')) return html(ARTICLE);
      if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
      return html('<html><body>Access denied</body></html>', 403, {
        'cf-mitigated': 'challenge',
      });
    });
    const page = await new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
    }).fetchPage('https://protected.example/story');
    expect(page.status).toBe('read');
    expect(page.text).toContain('Dr. Jason A. Demery');
    expect(page.archiveUrl).toContain('web.archive.org');
    expect(page.note).toMatch(/Internet Archive copy captured 2026-09-03/);
    expect(page.url).toBe('https://protected.example/story');
  });

  it('reports a login or payment wall and a missing page honestly', async () => {
    const fake = fakeFetch((url) => {
      if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
      if (url.includes('/login-only')) return html('sign in', 401);
      return html('gone', 404);
    });
    const fetcher = new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
    });
    const gated = await fetcher.fetchPage('https://site.example/login-only');
    expect(gated.status).toBe('restricted');
    const missing = await fetcher.fetchPage('https://site.example/gone');
    expect(missing.status).toBe('failed');
    expect(missing.note).toMatch(/HTTP 404/);
  });

  it('flags a short page that is mostly a paywall prompt', async () => {
    const body = `<html><body><p>Dr. Jason A. Demery testified in the trial of a local man accused of arson last spring.</p>
      <p>Subscribe to continue reading this article and get unlimited access to local news.</p></body></html>`;
    const fake = fakeFetch((url) =>
      url.endsWith('/robots.txt')
        ? new Response('', { status: 404 })
        : html(body),
    );
    const page = await new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: fake.impl,
      lookup: PUBLIC,
    }).fetchPage('https://paper.example/story');
    expect(page.status).toBe('read');
    expect(page.note).toMatch(/paywall/i);
  });

  it('reports a network failure without throwing', async () => {
    const impl = (() =>
      Promise.reject(new Error('socket hang up'))) as typeof fetch;
    const page = await new SafeFetcher({
      timeoutMs: 1000,
      fetchImpl: impl,
      lookup: PUBLIC,
    }).fetchPage('https://down.example/');
    expect(page.status).toBe('failed');
    expect(page.note).toMatch(/could not be reached/i);
  });
});
