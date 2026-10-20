import { extractPortraitCandidates } from './page-portraits';

const PAGE = 'https://clinic.example/about';

describe('extractPortraitCandidates', () => {
  it('reads og:image, a named JSON-LD Person image, and an img alt that names the person', () => {
    const html = `
      <html><head>
        <meta property="og:image" content="/photos/demery.jpg">
        <script type="application/ld+json">
          {"@type":"Person","name":"Jason A. Demery","image":"https://clinic.example/jason.jpg"}
        </script>
      </head>
      <body>
        <img src="/team/logo.png" alt="Clinic logo">
        <img src="/team/jason-headshot.png" alt="Dr. Jason A. Demery, Ph.D.">
      </body></html>`;
    const found = extractPortraitCandidates(html, PAGE);
    expect(found.map((item) => item.url)).toEqual([
      'https://clinic.example/photos/demery.jpg',
      'https://clinic.example/jason.jpg',
      'https://clinic.example/team/jason-headshot.png',
    ]);
    expect(found.find((item) => item.via === 'img')?.label).toMatch(/Demery/);
    expect(found.some((item) => item.url.includes('logo'))).toBe(false);
  });

  it('drops favicons and data URLs', () => {
    const html = `
      <meta property="og:image" content="data:image/png;base64,aaaa">
      <img src="/favicon.ico" alt="Jason Demery">`;
    expect(extractPortraitCandidates(html, PAGE)).toEqual([]);
  });
});
