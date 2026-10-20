import {
  decodeHtmlEntities,
  excerptAround,
  extractPageText,
  textContainsQuote,
} from './page-text';

describe('extractPageText', () => {
  const html = `<!doctype html><html><head>
    <title>Fallback title</title>
    <meta property="og:title" content="Woman charged &amp; now competent for trial">
    <meta name="description" content="A judge ruled on Tuesday.">
    <meta property="article:published_time" content="2026-09-02T14:30:00-04:00">
    <script>var secret = "do not show";</script>
    <style>.x { color: red }</style>
  </head><body>
    <nav><a href="/">Home</a><a href="/news">News</a></nav>
    <article>
      <h1>Judge says defendant is competent</h1>
      <p>Dr. Jason A. Demery, a neuropsychologist, testified for the defense.</p>
      <p>The state&rsquo;s expert disagreed.</p>
    </article>
    <form><input name="q"></form>
    <footer>Copyright</footer>
  </body></html>`;

  it('keeps the visible article text and drops scripts, navigation and forms', () => {
    const page = extractPageText(html);
    expect(page.text).toContain('Dr. Jason A. Demery, a neuropsychologist');
    expect(page.text).toContain("The state's expert disagreed.");
    expect(page.text).not.toContain('do not show');
    expect(page.text).not.toContain('color: red');
    expect(page.text).not.toContain('Home');
    expect(page.text).not.toContain('Copyright');
  });

  it('reads the title, description and publication date from the metadata', () => {
    const page = extractPageText(html);
    expect(page.title).toBe('Woman charged & now competent for trial');
    expect(page.description).toBe('A judge ruled on Tuesday.');
    expect(page.publishedAt).toBe('2026-09-02');
  });

  it('falls back to the title tag and reports no date when none is given', () => {
    const page = extractPageText(
      '<html><head><title>Plain page</title></head><body><p>Hello</p></body></html>',
    );
    expect(page.title).toBe('Plain page');
    expect(page.publishedAt).toBeNull();
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric entities and leaves unknown ones alone', () => {
    expect(decodeHtmlEntities('Fish &amp; chips &#169; &#x41; &unknown;')).toBe(
      'Fish & chips \u00a9 A &unknown;',
    );
  });

  it('does not throw on an impossible code point', () => {
    expect(decodeHtmlEntities('x&#99999999;y')).toBe('x y');
  });
});

describe('quote checks', () => {
  const text = 'He said the “expert” was ‘qualified’ — and the court agreed.';

  it('matches a quote regardless of curly quotes, dashes and spacing', () => {
    expect(
      textContainsQuote(
        text,
        'the "expert" was \'qualified\' - and the court agreed',
      ),
    ).toBe(true);
  });

  it('rejects text that is not on the page and quotes too short to prove anything', () => {
    expect(
      textContainsQuote(text, 'the court rejected the expert entirely'),
    ).toBe(false);
    expect(textContainsQuote(text, 'the court')).toBe(false);
  });

  it('returns the window around the first needle found', () => {
    const body = `${'a '.repeat(300)}Demery testified here.${' b'.repeat(300)}`;
    const excerpt = excerptAround(body, ['demery'], 100);
    expect(excerpt).toContain('Demery');
    expect((excerpt ?? '').length).toBeLessThanOrEqual(110);
    expect(excerptAround(body, ['nobody'])).toBeNull();
  });
});
