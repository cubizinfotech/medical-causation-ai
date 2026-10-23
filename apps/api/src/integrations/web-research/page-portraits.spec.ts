import {
  extractPortraitCandidates,
  usablePortraitCandidates,
} from './page-portraits';

const PAGE = 'https://clinic.example/about';
const HEADSHOT = 'https://clinic.example/team/jason-headshot.png';

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

  it('keeps a staff-photo class and a lazy-loaded srcset even without alt text', () => {
    const html = `
      <img class="staff-photo" data-src="/faculty/demery-headshot.jpg"
           srcset="/faculty/demery-headshot.jpg 1x, /faculty/demery-headshot-2x.jpg 2x">`;
    const found = extractPortraitCandidates(html, 'https://med.ufl.edu/faculty/demery');
    expect(found.map((item) => item.url)).toEqual([
      'https://med.ufl.edu/faculty/demery-headshot.jpg',
    ]);
    expect(found[0]?.label).toMatch(/headshot/i);
  });

  it('drops favicons and data URLs', () => {
    const html = `
      <meta property="og:image" content="data:image/png;base64,aaaa">
      <img src="/favicon.ico" alt="Jason Demery">`;
    expect(extractPortraitCandidates(html, PAGE)).toEqual([]);
  });
});

describe('usablePortraitCandidates', () => {
  const namedImg = {
    url: HEADSHOT,
    via: 'img' as const,
    label: 'Dr. Jason A. Demery',
  };
  const classOnly = {
    url: 'https://clinic.example/images/provider.jpg',
    via: 'img' as const,
    label: 'headshot',
  };
  const og = {
    url: 'https://clinic.example/photos/demery.jpg',
    via: 'og' as const,
  };
  const directoryOg = {
    url: 'https://healthgrades.com/img/site-share.png',
    via: 'og' as const,
  };
  const directoryNamed = {
    url: 'https://healthgrades.com/img/jason-demery.jpg',
    via: 'og' as const,
  };

  it('uses a named staff photo on a strong practice page', () => {
    expect(
      usablePortraitCandidates([namedImg], {
        kind: 'expert_website',
        matchLevel: 'strong',
        surname: 'Demery',
      }),
    ).toEqual([namedImg]);
  });

  it('uses a headshot-class image on a strong match even without the surname in alt text', () => {
    expect(
      usablePortraitCandidates([classOnly], {
        kind: 'expert_website',
        matchLevel: 'strong',
        surname: 'Demery',
      }),
    ).toEqual([classOnly]);
  });

  it('does not use an unnamed generic image on a possible match', () => {
    expect(
      usablePortraitCandidates([classOnly], {
        kind: 'expert_website',
        matchLevel: 'possible',
        surname: 'Demery',
      }),
    ).toEqual([]);
  });

  it('uses Open Graph photos on the person\'s own site', () => {
    expect(
      usablePortraitCandidates([og], {
        kind: 'expert_website',
        matchLevel: 'strong',
        surname: 'Demery',
      }),
    ).toEqual([og]);
  });

  it('uses a directory or review photo only when the image URL names the person', () => {
    expect(
      usablePortraitCandidates([directoryOg], {
        kind: 'review',
        matchLevel: 'strong',
        surname: 'Demery',
      }),
    ).toEqual([]);
    expect(
      usablePortraitCandidates([directoryNamed], {
        kind: 'review',
        matchLevel: 'strong',
        surname: 'Demery',
      }),
    ).toEqual([directoryNamed]);
  });

  it('never uses news, court, video or social pages', () => {
    for (const kind of ['news', 'court', 'justia', 'video', 'social']) {
      expect(
        usablePortraitCandidates([namedImg], {
          kind,
          matchLevel: 'strong',
          surname: 'Demery',
        }),
      ).toEqual([]);
    }
  });
});
