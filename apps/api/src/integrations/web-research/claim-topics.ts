/**
 * What a statement on a page is about, and who stands behind it.
 *
 * The search layer reads pages; the report needs each statement under the
 * right heading (board certification, membership, education, court order...).
 * Everything here is deterministic: a sentence is kept only when it appears
 * verbatim on the page and (unless the page is the person's own profile) names
 * the subject. Nothing is inferred beyond what the sentence says.
 */
import {
  quoteNamesOtherPerson,
  quoteNamesSubject,
  type IdentitySubject,
} from './identity-assess';
import type {
  WebClaim,
  WebClaimBasis,
  WebClaimTopic,
  WebSourceKind,
} from './web-research.types';

export const TOPIC_LABEL: Record<WebClaimTopic, string> = {
  education: 'Education',
  board_certification: 'Board certification',
  certification_org: 'Certification organization',
  license: 'License',
  discipline: 'Discipline or complaint',
  membership: 'Membership',
  publication: 'Publication',
  grant: 'Grant',
  patent: 'Patent',
  award: 'Award',
  military: 'Military',
  employment: 'Position or affiliation',
  corporate: 'Business',
  office: 'Office or address',
  review: 'Review',
  advertising: 'Advertising',
  ime: 'Independent medical examination',
  order: 'Court order',
  pleading: 'Pleading or motion',
  deposition: 'Deposition',
  testimony: 'Testimony',
  criminal: 'Criminal record',
  university_rules: 'University rule or policy',
  other: 'Other',
};

/** An issuing body or official registry. Its own pages are primary sources for the listed topics. */
export interface OfficialSource {
  id: string;
  name: string;
  hosts: readonly string[];
  topics: readonly WebClaimTopic[];
  /** Short names the body is known by, used to plan a search of its own site. */
  acronyms?: readonly string[];
}

export const OFFICIAL_SOURCES: readonly OfficialSource[] = [
  {
    id: 'abpp',
    name: 'American Board of Professional Psychology (ABPP)',
    hosts: ['abpp.org'],
    topics: ['board_certification', 'certification_org'],
    acronyms: ['ABPP', 'ABCN'],
  },
  {
    id: 'aacn',
    name: 'American Academy of Clinical Neuropsychology (AACN) member directory',
    hosts: ['theaacn.org'],
    topics: ['membership', 'certification_org'],
    acronyms: ['AACN'],
  },
  {
    id: 'abms',
    name: 'American Board of Medical Specialties (Certification Matters)',
    hosts: ['certificationmatters.org', 'abms.org'],
    topics: ['board_certification', 'certification_org'],
    acronyms: ['ABMS'],
  },
  {
    id: 'abim',
    name: 'American Board of Internal Medicine (ABIM)',
    hosts: ['abim.org'],
    topics: ['board_certification', 'certification_org'],
    acronyms: ['ABIM'],
  },
  {
    id: 'abpn',
    name: 'American Board of Psychiatry and Neurology (ABPN)',
    hosts: ['abpn.com'],
    topics: ['board_certification', 'certification_org'],
    acronyms: ['ABPN'],
  },
  {
    id: 'abp',
    name: 'American Board of Pediatrics (ABP)',
    hosts: ['abp.org'],
    topics: ['board_certification', 'certification_org'],
    acronyms: ['ABP'],
  },
  {
    id: 'abos',
    name: 'American Board of Orthopaedic Surgery (ABOS)',
    hosts: ['abos.org'],
    topics: ['board_certification', 'certification_org'],
    acronyms: ['ABOS'],
  },
  {
    id: 'fl_health',
    name: 'Florida Department of Health license lookup',
    hosts: [
      'mqa-internet.doh.state.fl.us',
      'flhealthsource.gov',
      'floridahealth.gov',
      'doh.state.fl.us',
    ],
    topics: ['license', 'discipline'],
  },
  {
    id: 'npi',
    name: 'NPI Registry (NPPES)',
    hosts: ['npiregistry.cms.hhs.gov'],
    topics: ['license', 'employment', 'office'],
  },
  {
    id: 'nih_reporter',
    name: 'NIH RePORTER',
    hosts: ['reporter.nih.gov'],
    topics: ['grant'],
  },
  {
    id: 'patents',
    name: 'Patent office records',
    hosts: ['patents.google.com', 'uspto.gov', 'ppubs.uspto.gov', 'wipo.int'],
    topics: ['patent'],
  },
  {
    id: 'military_valor',
    name: 'Military Valor awards',
    hosts: ['valor.defense.gov'],
    topics: ['military'],
  },
  {
    id: 'pubmed',
    name: 'PubMed / PubMed Central',
    hosts: [
      'pubmed.ncbi.nlm.nih.gov',
      'pmc.ncbi.nlm.nih.gov',
      'ncbi.nlm.nih.gov',
    ],
    topics: ['publication'],
  },
  {
    id: 'orcid',
    name: 'ORCID',
    hosts: ['orcid.org'],
    topics: ['publication', 'employment', 'education'],
  },
  {
    id: 'sunbiz',
    name: 'Florida Division of Corporations (Sunbiz)',
    hosts: ['sunbiz.org'],
    topics: ['corporate'],
  },
  {
    id: 'courts',
    name: 'Court record',
    hosts: [
      'courtlistener.com',
      'uscourts.gov',
      'govinfo.gov',
      'flcourts.gov',
      'floridasupremecourt.org',
      'justia.com',
    ],
    topics: ['order', 'pleading', 'deposition', 'testimony'],
  },
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hostIs(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function officialSourceFor(url: string): OfficialSource | null {
  const host = hostOf(url);
  if (!host) return null;
  for (const source of OFFICIAL_SOURCES) {
    if (hostIs(host, source.hosts)) return source;
  }
  // Any state government page that is a license or practitioner lookup.
  if (
    /(^|\.)([a-z]{2}\.gov|state\.[a-z]{2}\.us)$/.test(host) &&
    /licens|practitioner|verify|lookup|profile/i.test(new URL(url).pathname)
  ) {
    return {
      id: 'state_board',
      name: `State licensing record (${host})`,
      hosts: [host],
      topics: ['license', 'discipline'],
    };
  }
  return null;
}

/** The official source whose own site should be searched for a named body. */
export function officialSourceForAcronym(
  acronym: string,
): OfficialSource | null {
  const wanted = acronym.toUpperCase();
  return (
    OFFICIAL_SOURCES.find((source) => source.acronyms?.includes(wanted)) ?? null
  );
}

/** Certifying and professional bodies named in a text. */
const ORG_PATTERN =
  /\b(American Board of [A-Z][A-Za-z&]+(?: (?:and |of |in )?[A-Z][A-Za-z&]+){0,5}|American Academy of [A-Z][A-Za-z]+(?: (?:and |of )?[A-Z][A-Za-z]+){0,4}|National Board (?:for|of) [A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,4}|ABPP|ABCN|AACN|ABMS|ABIM|ABPN|NBCC)\b/g;

const ORG_EXPANSIONS: Record<string, string> = {
  ABPP: 'American Board of Professional Psychology',
  ABCN: 'American Board of Clinical Neuropsychology',
  AACN: 'American Academy of Clinical Neuropsychology',
  ABMS: 'American Board of Medical Specialties',
  ABIM: 'American Board of Internal Medicine',
  ABPN: 'American Board of Psychiatry and Neurology',
};

export interface NamedOrganization {
  /** Stable key: the acronym when known, else the lower-cased name. */
  key: string;
  /** Full name when the text states it; otherwise the acronym as written. */
  label: string;
  acronym: string | null;
}

/**
 * Bodies named in a text. An acronym is shown with its full name only when
 * the same text states the full name; the report never expands it silently.
 */
export function organizationsIn(text: string): NamedOrganization[] {
  const found = new Map<string, NamedOrganization>();
  const matches = [...text.matchAll(ORG_PATTERN)].map((m) => m[1]);
  for (const written of matches) {
    const isAcronym = /^[A-Z]{3,5}$/.test(written);
    if (isAcronym) {
      const full = ORG_EXPANSIONS[written];
      const stated =
        full && text.toLowerCase().includes(full.toLowerCase()) ? full : null;
      found.set(written, {
        key: written,
        label: stated ? `${stated} (${written})` : written,
        acronym: written,
      });
      continue;
    }
    const acronym =
      Object.entries(ORG_EXPANSIONS).find(
        ([, full]) => full.toLowerCase() === written.toLowerCase(),
      )?.[0] ?? null;
    const key = acronym ?? written.toLowerCase();
    const label = acronym ? `${written} (${acronym})` : written;
    found.set(key, { key, label, acronym });
  }
  return [...found.values()];
}

interface TopicRule {
  topic: WebClaimTopic;
  pattern: RegExp;
  /** Page kinds the rule applies to. Absent means any. */
  kinds?: readonly WebSourceKind[];
  /** Also requires this pattern in the sentence. */
  and?: RegExp;
  /** Drop the sentence when this pattern also matches. */
  unless?: RegExp;
}

/**
 * Navigation labels and section headings are not findings. "Clinical Trials,
 * Grants & Patents" on a directory is not a patent; "Award Winning Hospitals"
 * on WebMD is not an award.
 */
export function isHeadingClaim(quote: string): boolean {
  const text = quote.replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim();
  if (!text) return true;
  if (
    /^(certifications?(?:\s*(?:&|and)\s*licenses?)?|licenses?|clinical trials(?:[,& ]+grants?)?(?:[,& ]+patents?)?|grants?(?:\s*(?:&|and)\s*patents?)?|patents?|disciplinary actions?(?:\s*(?:&|and)\s*sanctions?)?|awards?|find a facility|award[- ]winning hospitals)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (
    text.length < 40 &&
    !/\b(is|was|are|were|has|have|holds|held|earned|completed|appointed|testified|provides|offers|lists|serves|served|performs|conducts)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

const COURTISH: readonly WebSourceKind[] = [
  'court',
  'justia',
  'news',
  'blog',
  'video',
  'other',
  'presentation',
];

const RULES: readonly TopicRule[] = [
  {
    topic: 'board_certification',
    pattern:
      /\b(board[- ]certified|board certification|certified by the American Board|diplomate|ABPP(?:[-\u2013]\s?[A-Z]{2,4})?|certified specialist)\b/i,
  },
  { topic: 'certification_org', pattern: ORG_PATTERN },
  {
    topic: 'membership',
    pattern:
      /\b(?:member|fellow|diplomate)\s+(?:of|in)\b|\bmembership\b|member directory|\bAACN\b|American Psychological Association|National Academy of Neuropsychology|International Neuropsychological Society/i,
  },
  {
    topic: 'education',
    pattern:
      /\b(?:Ph\.?\s?D\.?|Psy\.?\s?D\.?|M\.?\s?D\.?|M\.?\s?A\.?|M\.?\s?S\.?|B\.?\s?A\.?|B\.?\s?S\.?|A\.?\s?A\.?|doctorate|doctoral|master['\u2019]?s|bachelor['\u2019]?s|degree|graduat\w+|post-?doctoral|fellowship|internship|residency)\b/,
    and: /\b(University|College|School|Institute)\b/,
  },
  {
    topic: 'license',
    pattern: /\blicen[sc](?:ed|ure|e|es)\b/i,
  },
  {
    topic: 'discipline',
    pattern:
      /\b(?:disciplin\w+|sanction(?:ed|s)?|reprimand\w*|probation|revoked|suspended|board action|administrative complaint)\b/i,
  },
  {
    topic: 'publication',
    pattern:
      /\b(?:published|peer-reviewed|journal of|et al\.?|doi:|first author|co-?author(?:ed)?)\b/i,
  },
  {
    topic: 'grant',
    pattern:
      /\b(?:grant (?:from|number|no\.|award)|funded by|funding from|research funding|principal investigator|co-investigator|TRACK[- ]?TBI|R\d{2}\s?[A-Z]{2}\d{6}|(?:NIH|NINDS|NIMH|DoD|Department of Defense)\s+(?:grant|funded|support))\b/i,
  },
  { topic: 'patent', pattern: /\bpatent(?:s|ed)?\b|\bUSPTO\b/i },
  {
    topic: 'award',
    pattern:
      /\b(?:awarded|award recipient|recipient of|honou?red (?:with|by)|medal)\b|\baward\b/i,
  },
  {
    topic: 'military',
    pattern:
      /\b(?:veteran of|served in the|U\.S\.\s(?:Army|Navy|Air Force|Marine Corps|Coast Guard)|military service)\b/i,
  },
  {
    topic: 'employment',
    pattern:
      /\b(?:Assistant|Associate|Clinical)?\s?(?:Professor|Faculty|Director|Chief|Staff Neuropsychologist|Attending)\b[^.;]{0,80}\b(?:University|Hospital|Health|Center|Clinic|Institute)\b|\b(?:employed|works|practices|practicing) (?:at|with|for|in)\b/i,
  },
  {
    topic: 'office',
    pattern:
      /\b\d{2,6}\s+(?:[NSEW]{1,2}\s+)?[A-Z0-9][A-Za-z0-9.]*(?:\s+[A-Z0-9][A-Za-z0-9.]*){0,3}\s+(?:Ave|Avenue|St|Street|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Pkwy|Parkway|Ln|Lane|Ct|Court|Hwy|Highway|Suite|Ste)\b\.?[^.;]{0,60}/,
  },
  {
    topic: 'ime',
    pattern:
      /\bindependent (?:medical|psychological|neuropsychological) (?:exam\w*|evaluation\w*)\b|\bcompulsory (?:medical|mental|neuropsychological) exam\w*|\bRule 35\b|\bIMEs?\b|\bforensic (?:neuro)?psychological (?:exam\w*|evaluation\w*|assessment\w*)\b|\bmedicolegal (?:exam\w*|evaluation\w*|service\w*)\b/i,
  },
  {
    topic: 'advertising',
    pattern:
      /\b(?:expert witness services|services (?:include|offered|available)|available (?:for|to)|retained by|we offer|schedule an? (?:appointment|consultation)|evaluations? (?:to|for) (?:attorneys|courts|the court)|consult(?:ing|ant)? (?:to|for) (?:attorneys|courts|pharmaceutical|medical device))\b/i,
    kinds: [
      'expert_website',
      'advertising',
      'ime',
      'profile',
      'directory',
      'other',
    ],
  },
  {
    topic: 'order',
    pattern:
      /\b(?:it is hereby ordered|ordered that|motion (?:is )?(?:granted|denied)|court (?:granted|denied|appointed)|appointed [A-Z][^.]{0,60}(?:to|for) (?:examine|evaluate|conduct))\b/i,
    kinds: COURTISH,
  },
  {
    topic: 'pleading',
    pattern:
      /\b(?:motion (?:to|for)|memorandum|complaint|petition|response in opposition)\b/i,
    kinds: ['court', 'justia'],
  },
  {
    topic: 'deposition',
    // Require transcript-like phrasing. A lone "deposed" / "deposition" on an
    // OAH order or school-board page is an order mention, not a deposition file.
    pattern:
      /\b(?:deposition of|deposition transcript|notice of deposition|videotaped deposition|discovery deposition)\b/i,
    kinds: COURTISH,
  },
  {
    topic: 'testimony',
    pattern:
      /\b(?:testified|testimony|took the stand|direct examination|cross-examination|expert witness)\b/i,
    kinds: COURTISH,
  },
  {
    topic: 'criminal',
    pattern:
      /\b(?:arrest(?:ed)?|conviction|convicted of|criminal record|criminal history|mugshot|indicted)\b/i,
    kinds: ['news', 'court', 'justia', 'blog'],
    unless:
      /\b(?:examin(?:e[ds]?|ing)|evaluat\w+|competenc\w+|testif\w+|appoint(?:ed|ment)|the defendant|profiles of|murderers who)\b/i,
  },
  {
    topic: 'university_rules',
    // Only policy / COI / consulting-rule language — not "instructor of record"
    // on a syllabus or faculty bio alone.
    pattern:
      /\b(?:conflict of interest|outside (?:activity|employment|consulting)|consulting policy|faculty handbook|academic (?:policy|rule)|disclosure of outside|policy on consulting)\b/i,
    and: /\b(?:University|College|Professor|Faculty|policy|handbook)\b/i,
  },
];

/** Sentence-sized pieces of a text, each at most `max` characters. */
export function sentencesOf(text: string, max = 420): string[] {
  const raw = text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.!?;])\s+(?=[A-Z0-9\u201c"(])/)
    .map((piece) => piece.replace(/\s+/g, ' ').trim())
    .filter((piece) => piece.length > 0);
  // A full stop after a title or an initial ("Dr.", "Jason A.") is not a
  // sentence end: join the pieces back before judging length.
  const merged: string[] = [];
  for (const piece of raw) {
    const previous = merged[merged.length - 1];
    if (previous && ABBREVIATION_END.test(previous)) {
      merged[merged.length - 1] = `${previous} ${piece}`;
    } else {
      merged.push(piece);
    }
  }
  return merged
    .filter((piece) => piece.length >= 12)
    .map((piece) =>
      snapToWords(
        piece.length > max ? piece.slice(0, max) : piece,
        piece.length > max,
      ),
    );
}

const ABBREVIATION_END =
  /(?:\b[A-Z]|\b(?:Dr|Mr|Ms|Mrs|Prof|Jr|Sr|St|vs|No|Inc|Ltd|Co|Mt|Hon|Esq|al|Ph|Fla|Ave|Blvd))\.$/;

/** Cuts a piece at a word edge so a quote never ends or starts inside a word. */
function snapToWords(piece: string, truncated: boolean): string {
  if (!truncated) return piece;
  const space = piece.lastIndexOf(' ');
  return space > piece.length * 0.6 ? piece.slice(0, space) : piece;
}

/**
 * Window around the first rule hit of a very long run-on piece, so a quote
 * stays short and still contains the matched words. Always a substring.
 */
function windowAround(piece: string, index: number, width = 420): string {
  if (piece.length <= width) return piece;
  let start = Math.max(0, index - Math.floor(width / 2));
  if (start > 0) {
    const space = piece.indexOf(' ', start);
    if (space !== -1 && space - start < 40) start = space + 1;
  }
  let end = Math.min(piece.length, start + width);
  if (end < piece.length) {
    const space = piece.lastIndexOf(' ', end);
    if (space > start + width * 0.6) end = space;
  }
  return piece.slice(start, end).trim();
}

export function basisFor(
  topic: WebClaimTopic,
  input: { url: string; ownPage: boolean },
): WebClaimBasis {
  const official = officialSourceFor(input.url);
  if (official?.topics.includes(topic)) return 'primary_source';
  if (topic === 'discipline' || topic === 'criminal') return 'allegation';
  return input.ownPage ? 'subject_stated' : 'third_party';
}

const OWN_PAGE_KINDS: ReadonlySet<WebSourceKind> = new Set([
  'expert_website',
  'advertising',
  'ime',
  'profile',
]);

/** True when the page is the subject's own site or profile (not a court, news item or journal page). */
export function isOwnPage(
  kind: WebSourceKind,
  url: string,
  surname: string,
): boolean {
  if (OWN_PAGE_KINDS.has(kind)) return true;
  if (kind !== 'other') return false;
  return hostOf(url)
    .replace(/[^a-z]/g, '')
    .includes(surname.toLowerCase());
}

export interface FactInput {
  url: string;
  kind: WebSourceKind;
  title: string | null;
  text: string;
  subject: IdentitySubject;
  ownPage: boolean;
}

const PROFILE_KINDS: ReadonlySet<WebSourceKind> = new Set([
  'expert_website',
  'advertising',
  'ime',
  'profile',
]);

const MAX_PER_TOPIC = 3;
const MAX_FACTS = 16;

/**
 * Statements on a page that fall under a report topic. Each quote is a
 * substring of the page text. On multi-person, directory, news, or court
 * pages a sentence counts only if it names the subject’s first and last
 * name (or a compatible initial). Own-profile pages may count a sentence
 * without repeating the name unless that sentence names someone else.
 */
export function extractFacts(input: FactInput): WebClaim[] {
  const directoryLike =
    input.kind === 'directory' ||
    input.kind === 'news' ||
    input.kind === 'review' ||
    input.kind === 'court' ||
    input.kind === 'justia';
  // Practice sites are often classified as "other" until a model retags
  // them. If the page already writes the subject’s first and last name,
  // later sentences on that page may omit the first name.
  const pageIsSubjectProfile =
    input.kind === 'other' && quoteNamesSubject(input.text, input.subject.name);
  const ownProfile =
    (input.ownPage || PROFILE_KINDS.has(input.kind) || pageIsSubjectProfile) &&
    !directoryLike;

  const claims: WebClaim[] = [];
  const perTopic = new Map<WebClaimTopic, number>();
  const seen = new Set<string>();
  const pieces = sentencesOf(input.text, 4000);

  for (let i = 0; i < pieces.length; i++) {
    if (claims.length >= MAX_FACTS) break;
    const piece = pieces[i];
    const namesSubject = quoteNamesSubject(piece, input.subject.name);
    const namesOther = quoteNamesOtherPerson(piece, input.subject.name);
    if (namesOther && !namesSubject) continue;
    if (!ownProfile && !namesSubject) continue;
    for (const rule of RULES) {
      if (rule.kinds && !rule.kinds.includes(input.kind)) continue;
      if ((perTopic.get(rule.topic) ?? 0) >= MAX_PER_TOPIC) continue;
      const hit = new RegExp(rule.pattern.source, rule.pattern.flags).exec(
        piece,
      );
      if (!hit) continue;
      if (rule.and && !rule.and.test(piece)) continue;
      if (rule.unless && rule.unless.test(piece)) continue;
      if (!ownProfile && !namesSubject) continue;
      if (
        rule.topic === 'university_rules' &&
        /cell phones?|times new roman|late work|food and drinks/i.test(piece) &&
        !/\b(instructor|taught by|professor)\b/i.test(piece)
      ) {
        continue;
      }
      const quote = windowAround(piece, hit.index);
      if (isHeadingClaim(quote)) continue;
      const key = `${rule.topic}|${quote.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      perTopic.set(rule.topic, (perTopic.get(rule.topic) ?? 0) + 1);
      const basis = basisFor(rule.topic, {
        url: input.url,
        ownPage: input.ownPage,
      });
      claims.push({
        type: claimTypeFor(rule.topic, basis),
        text: claimText(rule.topic, quote, basis),
        quote,
        topic: rule.topic,
        basis,
        from: 'page',
      });
    }
  }
  return claims;
}

const PI_AWARD =
  /\b(?:principal investigator|P\.?I\.?\b|awardee|personally (?:awarded|received))\b/i;

export function claimText(
  topic: WebClaimTopic,
  quote: string,
  basis: WebClaimBasis,
): string {
  if (topic === 'grant') {
    const personal = PI_AWARD.test(quote) && basis === 'primary_source';
    return `${personal ? 'Personal award' : 'Associated with grant-funded research'}: ${quote}`.slice(
      0,
      400,
    );
  }
  return `${TOPIC_LABEL[topic]}: ${quote}`.slice(0, 400);
}

function claimTypeFor(
  topic: WebClaimTopic,
  basis: WebClaimBasis,
): WebClaim['type'] {
  if (basis === 'allegation') return 'allegation';
  switch (topic) {
    case 'advertising':
    case 'ime':
      return 'advertising';
    case 'order':
    case 'pleading':
    case 'deposition':
    case 'testimony':
      return 'forensic';
    case 'review':
      return 'rating';
    case 'other':
      return 'other';
    default:
      return 'credential';
  }
}

/** Topic of a claim the model returned without one. */
export function inferTopic(
  claim: Pick<WebClaim, 'type' | 'text' | 'quote'>,
  kind: WebSourceKind,
): WebClaimTopic {
  const text = `${claim.text} ${claim.quote}`;
  for (const rule of RULES) {
    if (rule.kinds && !rule.kinds.includes(kind)) continue;
    if (!new RegExp(rule.pattern.source, rule.pattern.flags).test(text))
      continue;
    if (rule.and && !rule.and.test(text)) continue;
    return rule.topic;
  }
  if (claim.type === 'advertising') return 'advertising';
  if (claim.type === 'rating') return 'review';
  if (claim.type === 'allegation') return 'discipline';
  return 'other';
}

/** Sentences of a search snippet that name the subject and fall under a topic. Not page text; labelled as such. */
export function factsFromSnippet(input: {
  url: string;
  kind: WebSourceKind;
  snippet: string;
  subject: IdentitySubject;
}): WebClaim[] {
  const out: WebClaim[] = [];
  const seen = new Set<string>();
  for (const piece of sentencesOf(input.snippet, 420)) {
    if (!quoteNamesSubject(piece, input.subject.name)) continue;
    if (
      quoteNamesOtherPerson(piece, input.subject.name) &&
      !quoteNamesSubject(piece, input.subject.name)
    ) {
      continue;
    }
    for (const rule of RULES) {
      if (rule.kinds && !rule.kinds.includes(input.kind)) continue;
      if (rule.topic === 'office') continue;
      const hit = new RegExp(rule.pattern.source, rule.pattern.flags).exec(
        piece,
      );
      if (!hit) continue;
      if (rule.and && !rule.and.test(piece)) continue;
      if (rule.unless && rule.unless.test(piece)) continue;
      if (isHeadingClaim(piece)) continue;
      const key = `${rule.topic}|${piece.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const basis = basisFor(rule.topic, { url: input.url, ownPage: false });
      out.push({
        type: claimTypeFor(rule.topic, basis),
        text: claimText(rule.topic, piece, basis),
        quote: piece,
        topic: rule.topic,
        basis,
        from: 'snippet',
      });
      if (out.length >= 6) return out;
    }
  }
  return out;
}
