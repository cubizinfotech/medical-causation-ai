import {
  capitalizeName,
  displayName,
} from '../expert-research/live/person-name';
import { parseCityState } from '../expert-research/live/location';
import { contextTerms, type IdentitySubject } from './identity-assess';
import { officialSourceForAcronym } from './claim-topics';
import type { SearchRequest, WebClaimTopic } from './web-research.types';

export type QueryTopic =
  | 'identity'
  | 'directories'
  | 'social'
  | 'reviews'
  | 'news'
  | 'news_adverse'
  | 'litigation'
  | 'discipline'
  | 'publications'
  | 'business'
  | 'advertising'
  | 'places'
  | 'context'
  | 'video'
  | 'certification'
  | 'certification_org'
  | 'education'
  | 'license'
  | 'memberships'
  | 'court_documents'
  | 'depositions'
  | 'grants'
  | 'patents'
  | 'awards'
  | 'ime'
  | 'criminal'
  | 'university_rules'
  | 'follow_up';

export interface PlannedQuery {
  id: string;
  topic: QueryTopic;
  request: SearchRequest;
  /** When set, only these providers run the query. */
  only?: readonly string[];
  /** Providers that should skip the query. */
  except?: readonly string[];
  /** Official site or registry this query searches, when it is one. */
  official?: { label: string; topics: readonly WebClaimTopic[] };
}

export interface FollowUpSignals {
  acronyms: readonly string[];
  state: string | null;
  programs?: readonly string[];
  institutions?: readonly string[];
  searchNih?: boolean;
}

const NEWS_ONLY = ['google_news_rss', 'gdelt'] as const;
const MAX_FOLLOW_UPS = 12;

function quote(value: string): string {
  return `"${value.replace(/"/g, '')}"`;
}

function nameClause(subject: IdentitySubject): {
  clause: string;
  label: string;
  short: string;
} {
  const label = displayName(subject.name);
  const short = `${capitalizeName(subject.name.first)} ${capitalizeName(subject.name.last)}`;
  const clause =
    label === short ? quote(label) : `(${quote(label)} OR ${quote(short)})`;
  return { clause, label, short };
}

/**
 * The questions to ask every search engine about a person. Written for any
 * profession; the profession and place narrow the search, and the intake note
 * adds its own queries. High-value topical searches run before news and
 * reviews so a deadline does not drop grants, IME or criminal records.
 */
export function planQueries(subject: IdentitySubject): PlannedQuery[] {
  const { clause, label } = nameClause(subject);
  const profession = subject.specialty.trim();
  const { city, state } = parseCityState(subject.city || '');
  const place = [city, state].filter(Boolean).join(' ');
  const base = `${clause} ${profession}`.trim();
  const where = place ? ` ${place}` : '';
  const plans: PlannedQuery[] = [];
  let counter = 0;
  const add = (
    topic: QueryTopic,
    request: Omit<SearchRequest, 'kind'> & { kind?: SearchRequest['kind'] },
    routing: Pick<PlannedQuery, 'only' | 'except'> = {},
  ) => {
    plans.push({
      id: `q${++counter}`,
      topic,
      request: { kind: 'web', ...request },
      ...routing,
    });
  };

  const subjectLine = `${label}, ${profession}${place ? `, ${place}` : ''}`;

  add('identity', {
    query: `${base}${where}`,
    prompt: `Find public web pages about ${subjectLine}: the person's own website, practice or company site, professional profiles, staff or faculty pages, and any biography.`,
  });
  add('certification', {
    query: `${clause} ("board certified" OR "board certification" OR ABPP OR diplomate OR "American Board of") ${profession}`,
    prompt: `Find which board certifications ${subjectLine} holds and which certifying organization issued each one (an American Board, ABPP, an ABMS member board or a specialty academy). Prefer the certifying body's own directory entry, then the person's own website, then court documents and directories. Give the page URL for each.`,
  });
  add('certification_org', {
    query: `${clause} ("find a board certified" OR "verify certification" OR "member directory" OR "certified specialist" OR "American Board of") ${profession}`,
    prompt: `Find the official certification directory or verification entry that lists ${subjectLine}: for example the ABPP "Find a Board Certified Specialist" search, ABMS Certification Matters, or a specialty academy's member directory such as AACN. Give the directory page for this person.`,
  });
  add('education', {
    query: `${clause} ${profession} (PhD OR "Ph.D." OR MD OR PsyD OR degree OR graduated OR fellowship OR residency OR internship OR "curriculum vitae") University`,
    prompt: `Find the education, degrees, training, internship, residency or fellowship of ${subjectLine}: university faculty pages, a curriculum vitae, directory profiles and biographies. Give the page URL for each statement.`,
  });
  add('license', {
    query: `${clause} ${profession} (license OR licensed OR "license verification" OR "license lookup" OR "licensure")${where}`,
    prompt: `Find the state license record for ${subjectLine}: license number, state, status and any public board action, from the state licensing board or health department lookup, or from pages that cite it.`,
  });
  add('memberships', {
    query: `${clause} ${profession} (member OR fellow OR "member directory" OR association OR society OR academy)`,
    prompt: `Find the professional memberships and fellowships of ${subjectLine}: association or academy member directories, society pages and biographies. Give the page URL for each.`,
  });
  add('publications', {
    query: `${clause} ${profession} publications OR "first author" OR research OR journal`,
    kind: 'scholar',
    prompt: `Find publications, research profiles (Google Scholar, ResearchGate, ORCID, PubMed, university pages) and presentations by ${subjectLine}.`,
  });
  add('grants', {
    query: `${clause} ${profession} (grant OR "NIH" OR "principal investigator" OR "co-investigator" OR "funded by" OR "research funding" OR TRACK-TBI OR "Department of Defense")`,
    prompt: `Find research grants, funded projects and funding acknowledgements connected to ${subjectLine}: NIH RePORTER, DoD, TRACK-TBI, university pages and papers. For each, say whether the page lists this person as the principal investigator / awardee or only as a co-investigator, author or contributor. A paper about a funded project is not itself a personal grant award.`,
  });
  add('ime', {
    query: `${clause} ("independent medical examination" OR IME OR "compulsory examination" OR "Rule 35" OR "forensic evaluation" OR medicolegal OR "available to attorneys")${where}`,
    prompt: `Find pages where ${subjectLine} offers or performs independent medical examinations, forensic or medicolegal evaluations, Rule 35 examinations, or consulting for attorneys, including the person's own website and court mentions.`,
  });
  add('advertising', {
    query: `${clause} ${profession} "independent medical" OR IME OR "expert witness services" OR "available for" OR "retained by" OR medicolegal${where}`,
    prompt: `Find advertising or marketing by ${subjectLine} for expert witness, forensic, consulting or independent examination services, including the person's website, brochure or directory advert.`,
  });
  add('directories', {
    query: `${clause} "expert witness" OR "expert directory" OR "forensic" ${profession}`,
    prompt: `Find expert witness directory or marketplace listings for ${subjectLine}. Look at SEAK, JurisPro, ExpertPages, ExpertWitness.com, DRI, ALM Experts, ExpertLaw and similar sites, plus the person's forensic or IME advertising.`,
  });
  add('directories', {
    query: `${clause} site:seakexperts.com`,
    prompt: `Find the public SEAK expert directory listing for ${subjectLine}, if one exists. Do not treat a missing listing as proof that none exists.`,
  });
  add('directories', {
    query: `${clause} site:jurispro.com`,
    prompt: `Find the public JurisPro listing for ${subjectLine}, if one exists. Do not treat a missing listing as proof that none exists.`,
  });
  add('directories', {
    query: `${clause} site:expertpages.com`,
    prompt: `Find the public ExpertPages listing for ${subjectLine}, if one exists. Do not treat a missing listing as proof that none exists.`,
  });
  add('court_documents', {
    query: `${clause} ("motion to compel" OR "order" OR "memorandum" OR "report and recommendation" OR "appointed" OR "competency") filetype:pdf`,
    prompt: `Find court orders, motions, pleadings and reports that name ${subjectLine} as an examining, appointed or testifying expert. Prefer the court's own PDF or docket page.`,
  });
  add('litigation', {
    query: `${clause} (site:law.justia.com OR site:courtlistener.com OR site:casetext.com OR site:leagle.com OR site:casemine.com)`,
    prompt: `Find court opinions on Justia, CourtListener, Casetext, Leagle or similar sites that mention ${subjectLine}.`,
  });
  add('litigation', {
    query: `${clause} (testified OR testimony OR "expert witness" OR Daubert OR "motion to exclude" OR disqualified OR deposition OR court)`,
    prompt: `Find public court opinions, dockets, motions, orders or news about court proceedings where ${subjectLine} testified, was an expert witness, or was challenged (Daubert, Frye, motion to exclude, disqualification).`,
  });
  add('depositions', {
    query: `${clause} (deposition OR "transcript" OR "cross-examination" OR "testimony transcript" OR "sworn testimony")`,
    prompt: `Find deposition or trial testimony transcripts, excerpts or recordings of ${subjectLine}. Give the page URL and say whether a transcript is available.`,
  });
  add('criminal', {
    query: `${clause} (arrested OR conviction OR "criminal record" OR mugshot OR indicted OR "criminal history")${where}`,
    prompt: `Find public records or news that this exact person, ${subjectLine}, was arrested, charged, convicted or has a criminal record. Do not treat a case in which this person examined, evaluated or testified about someone else as this person's own criminal record.`,
  });
  add('discipline', {
    query: `${clause} (disciplinary OR sanction OR "board action" OR revoked OR suspended OR malpractice OR lawsuit OR complaint)`,
    prompt: `Find public records or news reporting any disciplinary action, license restriction, malpractice claim, lawsuit or complaint involving ${subjectLine}. Only report pages that clearly concern this person.`,
  });
  add('social', {
    query: `${clause} ${profession} (site:linkedin.com OR site:facebook.com OR site:instagram.com OR site:x.com OR site:twitter.com OR site:tiktok.com)`,
    prompt: `Find public social media profiles (LinkedIn, Facebook, Instagram, X/Twitter, TikTok, Threads, Bluesky) for ${subjectLine}. Give the https URL and visible handle. Include (1) personal profiles of this person and (2) official employer or institutional accounts named as channels for this person's work, labelled institutional not personal. If no personal profile is found, still list the institutional URLs the pages name.`,
  });
  add('business', {
    query: `${clause} ${profession} (LLC OR "P.A." OR PLLC OR Inc OR corporation OR "registered agent" OR sunbiz OR opencorporates)${where}`,
    prompt: `Find business registry or company records (Secretary of State, Sunbiz, OpenCorporates, Bizapedia) and company websites where ${subjectLine} is an officer, owner, registered agent or practice principal.`,
  });
  add('news', {
    query: clause,
    kind: 'news',
    prompt: `Find news articles, press releases and blog posts that mention ${subjectLine}. Include court coverage where this person testified or was named.`,
  });
  add(
    'news',
    {
      query: `${clause} (site:courttv.com OR site:law360.com OR site:apnews.com OR site:abajournal.com OR site:usatoday.com OR site:cnn.com OR site:foxnews.com)`,
      prompt: `Find news and court-coverage articles (Court TV, local TV and newspaper sites, AP, Law360) where ${subjectLine} testified, evaluated a defendant or party, served as an expert witness, or was named in reporting. Quote what the article says about this person.`,
    },
    { except: NEWS_ONLY },
  );
  add('video', {
    query: `${clause} ${profession} (site:youtube.com OR site:vimeo.com OR podcast OR webinar OR lecture OR presentation)`,
    prompt: `Find public videos, podcasts, webinars, lectures or slide presentations featuring ${subjectLine}.`,
  });
  add('reviews', {
    query: `${clause} ${profession} reviews OR ratings OR complaints (healthgrades OR vitals OR ratemds OR yelp OR google OR bbb OR avvo)`,
    prompt: `Find public patient, client or customer reviews, ratings and complaints for ${subjectLine} (Healthgrades, Vitals, RateMDs, Yelp, Google reviews, BBB, Avvo and similar). Include the rating and number of reviews when shown.`,
  });
  add('patents', {
    query: `${clause} (patent OR inventor OR "patent application" OR trademark) ${profession}`,
    prompt: `Find patents, patent applications or trademarks with ${subjectLine} as inventor or owner (Google Patents, USPTO).`,
  });
  add('awards', {
    query: `${clause} ${profession} (award OR honor OR medal OR "veteran" OR "military service" OR "U.S. Army" OR "U.S. Navy")`,
    prompt: `Find awards, honors and any military service claimed by or reported about ${subjectLine}. Give the page URL for each.`,
  });
  add('places', {
    query: `${base}${where}`,
    kind: 'places',
    prompt: `Find the office or business location, address, phone and website for ${subjectLine}.`,
  });
  add(
    'news_adverse',
    {
      query: `${clause} ${city}`.trim(),
      kind: 'news',
      prompt: `Find news coverage about ${subjectLine}.`,
    },
    { only: NEWS_ONLY },
  );

  const extras = contextTerms(subject.context).slice(0, 4);
  for (const term of extras) {
    add('context', {
      query: `${clause} ${quote(term)}`,
      prompt: `Find public pages that connect ${subjectLine} with "${term}".`,
    });
  }
  if (subject.context && subject.context.trim().length > 0) {
    add('context', {
      query: `${clause} ${profession} ${subject.context.replace(/\s+/g, ' ').trim().slice(0, 120)}`,
      prompt: `${subject.context.trim().slice(0, 600)}\n\nThe person to research is ${subjectLine}. Find public pages about them that relate to the note above.`,
    });
  }

  return plans;
}

/**
 * A second, small round of searches built from what the first round found:
 * official sites of named bodies, NIH RePORTER, named research programs,
 * faculty/COI pages at named institutions, and the state license lookup.
 */
export function planFollowUps(
  subject: IdentitySubject,
  signals: FollowUpSignals,
): PlannedQuery[] {
  const { clause, label } = nameClause(subject);
  const profession = subject.specialty.trim();
  const plans: PlannedQuery[] = [];
  const seen = new Set<string>();
  let counter = 0;
  const push = (
    topic: QueryTopic,
    request: Omit<SearchRequest, 'kind'>,
    official?: PlannedQuery['official'],
  ) => {
    if (plans.length >= MAX_FOLLOW_UPS) return;
    const key = request.query.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    plans.push({
      id: `f${++counter}`,
      topic,
      request: { kind: 'web', ...request },
      ...(official ? { official } : {}),
    });
  };
  for (const acronym of signals.acronyms) {
    const source = officialSourceForAcronym(acronym);
    const host = source?.hosts[0];
    if (!source || !host || seen.has(host)) continue;
    seen.add(host);
    const topic: QueryTopic = source.topics.includes('board_certification')
      ? 'certification_org'
      : 'memberships';
    push(
      topic,
      {
        query: `site:${host} ${clause}`,
        prompt: `Find the entry for ${label} (${profession}) on the official site of ${source.name} (${host}): certification status, specialty and member or directory listing.`,
      },
      { label: host, topics: source.topics },
    );
  }
  if (signals.searchNih !== false) {
    push(
      'grants',
      {
        query: `site:reporter.nih.gov ${clause}`,
        prompt: `Find NIH RePORTER project pages that list ${label} (${profession}) as a principal investigator. Do not treat a co-author paper as a personal NIH award.`,
      },
      { label: 'NIH RePORTER', topics: ['grant'] },
    );
  }
  for (const program of (signals.programs ?? []).slice(0, 3)) {
    push('grants', {
      query: `${clause} ${quote(program)}`,
      prompt: `Find public pages that connect ${label} (${profession}) with the research program ${program}. Say whether the page lists this person as a principal investigator, co-investigator, author or contributor. A paper about a funded project is not a personal grant award.`,
    });
  }
  for (const institution of (signals.institutions ?? []).slice(0, 3)) {
    push('university_rules', {
      query: `${clause} ${quote(institution)} (faculty OR "conflict of interest" OR "outside activity" OR "consulting policy" OR "outside consulting")`,
      prompt: `Find the faculty or staff page for ${label} at ${institution}, and any public conflict-of-interest, outside-activity or consulting policy that would apply to that role. Do not report a generic course syllabus unless it names this person as the instructor.`,
    });
  }
  const florida = !signals.state || signals.state === 'FL';
  push(
    'license',
    {
      query: florida
        ? `${clause} (site:mqa-internet.doh.state.fl.us OR site:flhealthsource.gov) ${profession}`
        : `${clause} ${profession} "license verification"`,
      prompt: florida
        ? `Find the Florida Department of Health license verification record for ${label} (${profession}): license number, status, expiration and any public discipline.`
        : `Find the state licensing board verification record for ${label} (${profession}) in ${signals.state}: license number, status and any public discipline.`,
    },
    {
      label: florida
        ? 'Florida Department of Health license lookup'
        : `${signals.state} licensing board`,
      topics: ['license', 'discipline'],
    },
  );
  return plans;
}
