import { parsePersonName } from '../expert-research/live/person-name';
import type { IdentitySubject } from './identity-assess';
import {
  planFollowUps,
  planQueries,
  selectQueriesForBudget,
} from './query-planner';

const subject = (over: Partial<IdentitySubject> = {}): IdentitySubject => ({
  name: parsePersonName('Jason A. Demery') as NonNullable<
    ReturnType<typeof parsePersonName>
  >,
  city: 'Gainesville, FL',
  specialty: 'Neuropsychology',
  ...over,
});

describe('planQueries', () => {
  it('asks about every area for any profession', () => {
    const topics = new Set(planQueries(subject()).map((plan) => plan.topic));
    for (const topic of [
      'identity',
      'portrait',
      'directories',
      'news',
      'litigation',
      'discipline',
      'social',
      'video',
      'reviews',
      'publications',
      'business',
      'advertising',
      'places',
      'certification',
      'certification_org',
      'education',
      'license',
      'memberships',
      'court_documents',
      'depositions',
      'grants',
      'patents',
      'awards',
      'military_claims',
      'ime',
      'criminal',
    ]) {
      expect(topics).toContain(topic);
    }
  });

  it('asks for personal and institutional social profile URLs', () => {
    const social = planQueries(subject()).find(
      (plan) => plan.topic === 'social',
    );
    expect(social?.request.prompt).toMatch(/institutional/i);
    expect(social?.request.prompt).toMatch(/https URL/i);
  });

  it('splits social search into per-platform site queries and paginates high-value topics', () => {
    const plans = planQueries(subject());
    const socialQueries = plans
      .filter((plan) => plan.topic === 'social')
      .map((plan) => plan.request.query);
    expect(socialQueries.some((q) => q.includes('site:linkedin.com'))).toBe(
      true,
    );
    expect(socialQueries.some((q) => q.includes('site:facebook.com'))).toBe(
      true,
    );
    expect(socialQueries.some((q) => q.includes('site:instagram.com'))).toBe(
      true,
    );
    expect(socialQueries.some((q) => q.includes('site:bsky.app'))).toBe(true);
    expect(
      plans.some(
        (plan) =>
          plan.request.query.includes('site:dri.org') &&
          /speaker|conference/.test(plan.request.query),
      ),
    ).toBe(true);
    expect(
      plans.some((plan) => plan.request.query.includes('site:abpp.org')),
    ).toBe(true);
    expect(
      plans.some((plan) => plan.request.query.includes('site:theaacn.org')),
    ).toBe(true);
    expect(
      plans.some((plan) => plan.request.query.includes('site:hgexperts.com')),
    ).toBe(true);
    expect(
      plans.some((plan) =>
        plan.request.query.includes('site:expertinstitute.com'),
      ),
    ).toBe(true);
    expect(
      plans.some((plan) =>
        plan.request.query.includes('site:expertwitnessprofiler.com'),
      ),
    ).toBe(true);
    expect(
      plans.some((plan) =>
        plan.request.query.includes('site:patents.google.com'),
      ),
    ).toBe(true);
    expect(
      plans.some((plan) =>
        plan.request.query.includes('site:valor.defense.gov'),
      ),
    ).toBe(true);
    const identity = plans.find((plan) => plan.topic === 'identity');
    expect(identity?.paginate).toBe(true);
    expect(identity?.request.num).toBe(20);
  });

  it('always searches for a staff or practice photograph', () => {
    const portrait = planQueries(subject()).find(
      (plan) => plan.topic === 'portrait',
    );
    expect(portrait?.request.query).toMatch(
      /headshot|profile photo|biography/i,
    );
    expect(portrait?.request.query).toMatch(/Neuropsychology/);
    expect(portrait?.request.query).toMatch(/Gainesville/);
    expect(portrait?.request.prompt).toMatch(/photograph/i);
    const topics = planQueries(subject()).map((plan) => plan.topic);
    expect(topics.indexOf('portrait')).toBeGreaterThan(
      topics.indexOf('identity'),
    );
    expect(topics.indexOf('portrait')).toBeLessThan(
      topics.indexOf('certification'),
    );
  });

  it('uses the profession and the place to narrow the search', () => {
    const identity = planQueries(subject()).find(
      (plan) => plan.topic === 'identity',
    );
    expect(identity?.request.query).toContain('"Jason A. Demery"');
    expect(identity?.request.query).toContain('Neuropsychology');
    expect(identity?.request.query).toContain('Gainesville FL');
    expect(identity?.request.prompt).toContain('Jason A. Demery');
  });

  it('searches a long specialty title by the field word', () => {
    const identity = planQueries(
      subject({ specialty: 'Clinical & Forensic Neuropsychologist' }),
    ).find((plan) => plan.topic === 'identity');
    expect(identity?.request.query).toContain('Neuropsychologist');
    expect(identity?.request.query).not.toMatch(/Clinical & Forensic/);
    expect(identity?.request.prompt).toContain(
      'Clinical & Forensic Neuropsychologist',
    );
  });

  it('works for a profession that is not medical', () => {
    const plans = planQueries(
      subject({ specialty: 'Licensed electrician', city: 'Dallas, TX' }),
    );
    const identity = plans.find((plan) => plan.topic === 'identity');
    expect(identity?.request.query).toContain('Licensed electrician');
    expect(plans.length).toBeGreaterThan(8);
  });

  it('does not write empty or "undefined" place text when no city is given', () => {
    const plans = planQueries(subject({ city: '' }));
    for (const plan of plans) {
      expect(plan.request.query).not.toMatch(/undefined|null|\s{2,}$/);
      expect(plan.request.prompt ?? '').not.toMatch(
        /undefined|null|, ,|,\s*\./,
      );
    }
    const identity = plans.find((plan) => plan.topic === 'identity');
    expect(identity?.request.query).toBe(
      '("Jason A. Demery" OR "Jason Demery") Neuropsychology',
    );
  });

  it('keeps the exact-name news index query away from search engines', () => {
    const plans = planQueries(subject());
    const newsOnly = plans.find((plan) => plan.topic === 'news_adverse');
    expect(newsOnly?.only).toEqual(['google_news_rss', 'gdelt']);
    const publisherSites = plans.find((plan) =>
      plan.request.query.includes('site:courttv.com'),
    );
    expect(publisherSites?.except).toEqual(['google_news_rss', 'gdelt']);
  });

  it('adds queries for names and employers in the additional context', () => {
    const without = planQueries(subject());
    const withContext = planQueries(
      subject({
        context:
          'Also known as "Jay Demery". Worked at Shands Hospital. Case: State v. Smith',
      }),
    );
    expect(withContext.length).toBeGreaterThan(without.length);
    const contextual = withContext.filter((plan) => plan.topic === 'context');
    expect(contextual.length).toBeGreaterThan(0);
    expect(contextual.map((plan) => plan.request.query).join('\n')).toMatch(
      /Shands|Jay Demery/,
    );
  });

  it('adds public directory site queries without treating them as every directory', () => {
    const queries = planQueries(subject()).map((plan) => plan.request.query);
    expect(queries.some((q) => q.includes('site:seakexperts.com'))).toBe(true);
    expect(queries.some((q) => q.includes('site:jurispro.com'))).toBe(true);
    expect(queries.some((q) => q.includes('site:expertpages.com'))).toBe(true);
    expect(queries.some((q) => q.includes('site:dri.org'))).toBe(true);
    expect(queries.some((q) => q.includes('site:almexperts.com'))).toBe(true);
    expect(queries.some((q) => q.includes('site:expertlaw.com'))).toBe(true);
    expect(queries.some((q) => q.includes('site:expertwitness.com'))).toBe(
      true,
    );
    expect(queries.some((q) => q.includes('site:expertinstitute.com'))).toBe(
      true,
    );
  });

  it('gives every query a unique id', () => {
    const ids = planQueries(subject({ context: 'Shands Hospital' })).map(
      (plan) => plan.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('planFollowUps', () => {
  it('searches the official site of each body a page named, then the license lookup', () => {
    const plans = planFollowUps(subject(), {
      acronyms: ['ABPP', 'AACN', 'ABPP', 'ZZZZ'],
      state: 'FL',
    });
    const queries = plans.map((plan) => plan.request.query);
    expect(queries.some((q) => q.startsWith('site:abpp.org'))).toBe(true);
    expect(queries.some((q) => q.startsWith('site:theaacn.org'))).toBe(true);
    expect(queries.filter((q) => q.includes('abpp.org'))).toHaveLength(1);
    const license = plans.find((plan) => plan.topic === 'license');
    expect(license?.request.query).toContain('mqa-internet.doh.state.fl.us');
    expect(license?.official?.topics).toContain('license');
    const abpp = plans.find((plan) => plan.official?.label === 'abpp.org');
    expect(abpp?.official?.topics).toContain('board_certification');
  });

  it('searches extra license states named on a page', () => {
    const plans = planFollowUps(subject(), {
      acronyms: [],
      state: 'FL',
      licenseStates: ['TX', 'GA'],
    });
    const licenseQueries = plans
      .filter((plan) => plan.topic === 'license')
      .map((plan) => plan.request.query)
      .join('\n');
    expect(licenseQueries).toMatch(/mqa-internet\.doh\.state\.fl\.us/);
    expect(licenseQueries).toMatch(/TX/);
    expect(licenseQueries).toMatch(/GA/);
  });

  it('does not point a non-Florida expert at the Florida lookup', () => {
    const plans = planFollowUps(subject({ city: 'Dallas, TX' }), {
      acronyms: [],
      state: 'TX',
    });
    expect(plans.some((p) => p.request.query.includes('state.fl.us'))).toBe(
      false,
    );
    const license = plans.find((plan) => plan.topic === 'license');
    expect(license?.request.prompt).toContain('TX');
  });

  it('follows named programs, NIH RePORTER and faculty policy pages', () => {
    const plans = planFollowUps(subject(), {
      acronyms: [],
      state: 'FL',
      programs: ['TRACK-TBI'],
      institutions: ['University of Florida'],
      searchNih: true,
    });
    expect(
      plans.some((p) => p.request.query.includes('reporter.nih.gov')),
    ).toBe(true);
    expect(plans.some((p) => p.request.query.includes('TRACK-TBI'))).toBe(true);
    expect(
      plans.some(
        (p) =>
          p.topic === 'university_rules' &&
          p.request.query.includes('University of Florida'),
      ),
    ).toBe(true);
    expect(
      plans.some(
        (p) =>
          p.topic === 'university_accreditation' &&
          p.request.query.includes('site:chea.org'),
      ),
    ).toBe(true);
    expect(
      plans.some(
        (p) =>
          p.topic === 'university_accreditation' &&
          p.request.query.includes('site:ope.ed.gov'),
      ),
    ).toBe(true);
    expect(
      plans.some(
        (p) =>
          p.topic === 'university_accreditation' &&
          /accreditation\.apa\.org|apa\.org\/ed\/accreditation/.test(
            p.request.query,
          ),
      ),
    ).toBe(true);
  });
});

describe('planQueries order', () => {
  it('runs grants and IME before news and reviews', () => {
    const topics = planQueries(subject()).map((plan) => plan.topic);
    expect(topics.indexOf('grants')).toBeLessThan(topics.indexOf('news'));
    expect(topics.indexOf('ime')).toBeLessThan(topics.indexOf('reviews'));
    expect(topics.indexOf('patents')).toBeLessThan(topics.indexOf('news'));
    expect(topics.indexOf('criminal')).toBeLessThan(topics.indexOf('video'));
  });
});

describe('selectQueriesForBudget', () => {
  it('keeps patents, IME and directories when the budget cannot run every query', () => {
    const { selected, omitted } = selectQueriesForBudget(
      planQueries(subject()),
      35,
    );
    const topics = new Set(selected.map((plan) => plan.topic));
    expect(topics.has('patents')).toBe(true);
    expect(topics.has('ime')).toBe(true);
    expect(topics.has('advertising')).toBe(true);
    expect(topics.has('directories')).toBe(true);
    expect(topics.has('military_claims')).toBe(true);
    expect(
      omitted.some((plan) => plan.topic === 'reviews' || plan.topic === 'news'),
    ).toBe(true);
  });
});
