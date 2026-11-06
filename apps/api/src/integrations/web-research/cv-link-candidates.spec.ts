import {
  extractCvLinkCandidates,
  scoreCvLinkCandidate,
  selectTopCvCandidates,
} from './cv-link-candidates';

describe('cv-link-candidates', () => {
  it('scores explicit CV / resume link text highly', () => {
    const scored = scoreCvLinkCandidate({
      href: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view',
      text: 'Download CV',
      pageUrl: 'https://drjaneexpert.com/about',
      pageTitle: 'About Dr. Jane Expert',
    });
    expect(scored).not.toBeNull();
    expect(scored!.score).toBeGreaterThanOrEqual(50);
    expect(scored!.reason).toMatch(/link-text|google-drive/);
  });

  it('scores CV-named PDF paths', () => {
    const scored = scoreCvLinkCandidate({
      href: '/docs/Jane-Expert-CV.pdf',
      text: 'PDF',
      pageUrl: 'https://janeexpert.com/',
    });
    expect(scored).not.toBeNull();
    expect(scored!.reason).toMatch(/path|pdf/);
  });

  it('extracts CV links from an About page and dedupes', () => {
    const html = `
      <html><head><title>About Jane Expert, Ph.D.</title></head><body>
        <a href="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view">Curriculum Vitae</a>
        <a href="/Jane-Expert-CV.pdf">Download Resume</a>
        <a href="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view">CV</a>
        <a href="/brochure.pdf">Office brochure</a>
        <a href="https://facebook.com/jane">Facebook</a>
      </body></html>`;
    const found = extractCvLinkCandidates(html, 'https://janeexpert.com/about', {
      pageTitle: 'About Jane Expert, Ph.D.',
    });
    expect(found.some((c) => c.url.includes('drive.google.com'))).toBe(true);
    expect(found.some((c) => c.url.includes('Jane-Expert-CV.pdf'))).toBe(true);
    expect(
      found.filter((c) => c.url.includes('1AbCdEfGhIjKlMnOpQrStUv')).length,
    ).toBe(1);
    expect(found.every((c) => !/facebook/i.test(c.url))).toBe(true);
  });

  it('keeps a generic PDF on a biography page as a weak candidate', () => {
    const scored = scoreCvLinkCandidate({
      href: '/uploads/document.pdf',
      text: 'Download',
      pageUrl: 'https://practice.example/biography',
      pageTitle: 'Professional Biography',
    });
    expect(scored).not.toBeNull();
  });

  it('selectTopCvCandidates sorts and limits', () => {
    const top = selectTopCvCandidates(
      [
        { url: 'a', text: 'a', score: 40, reason: 'x' },
        { url: 'b', text: 'b', score: 90, reason: 'y' },
        { url: 'a', text: 'a2', score: 50, reason: 'z' },
      ],
      1,
    );
    expect(top).toHaveLength(1);
    expect(top[0].url).toBe('b');
  });
});
