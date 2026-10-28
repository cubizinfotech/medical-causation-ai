/**
 * Routes what the web research found to the report sections it belongs to.
 *
 * The web run returns pages. A page is not a section: one page can state a
 * degree, a board certification and a membership. This module reads the
 * statements recorded for each page (see claim-topics) and files each one under
 * the section that is about it, with its source, quote and who stands behind it.
 *
 * Pure and deterministic: the same dossier always gives the same sections, and
 * nothing is added that a page did not say.
 */
import {
  officialSourceFor,
  organizationsIn,
  TOPIC_LABEL,
} from './claim-topics';
import { looksLikeCourtDocument } from './source-kind';
import { sosDeepLinksFor } from './sos-business-search';
import { isPaidAdvertisingDirectory } from './web-source-providers';
import type {
  WebClaim,
  WebClaimBasis,
  WebClaimTopic,
  WebRecord,
  WebResearchDossier,
  WebSourceKind,
  WebVerification,
} from './web-research.types';

function isPaidDirectoryRecord(record: WebRecord): boolean {
  return isPaidAdvertisingDirectory(record);
}

/**
 * School boards, associate bios, and similar pages that repeatedly polluted
 * Ellenberg depositions/testimony. They are not the subject’s credentials or
 * sworn testimony.
 */
function isIrrelevantNoiseRecord(record: WebRecord): boolean {
  const host = (() => {
    try {
      return new URL(record.url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  const path = (() => {
    try {
      return new URL(record.url).pathname.toLowerCase();
    } catch {
      return record.url.toLowerCase();
    }
  })();
  const hay = `${record.url} ${record.title} ${record.summary}`.toLowerCase();
  if (host.includes('parkcenturyschool')) return true;
  if (/\bboard of trustees\b/.test(hay) && /\b(school|academy|college)\b/.test(hay)) {
    return true;
  }
  // Practice-site associate pages (e.g. /kristen.html, /dylan.html, glassCV.pdf).
  if (
    /\/(kristen|dylan|jesse|fischer|thompson|glass)(\.html?)?$/i.test(path) ||
    /\/(associates?|team|staff)\/(kristen|dylan|jesse|thompson|glass)/i.test(
      path,
    ) ||
    /(?:^|\/)(kristen|dylan|jesse|fischer|thompson|glass)[_-]?cv(?:\.pdf)?$/i.test(
      path,
    ) ||
    /(?:^|\/)c\.?v\.?-?(kristen|dylan|jesse|fischer|thompson|glass)/i.test(path)
  ) {
    return true;
  }
  if (
    /\b(kristen\s+thompson|leila\s+glass|jesse\s+fischer)\b/.test(hay) &&
    /\b(curriculum vitae|\bcv\b|resume)\b/.test(hay) &&
    !/\bleah\s+ellenberg\b/.test(hay.slice(0, 240))
  ) {
    return true;
  }
  if (
    /\bkristen\s+thompson\b/.test(hay) &&
    !/\bleah\s+ellenberg\b/.test(hay.slice(0, 200))
  ) {
    return true;
  }
  return false;
}

/**
 * True when the claim may support a credential section: the page host must
 * be the issuing body / official registry for that topic. Practice sites,
 * directories, news, and a model “primary_source” tag alone are not enough.
 */
function isIssuingBodyCredentialClaim(
  record: WebRecord,
  claim: WebClaim,
  basis: WebClaimBasis | 'record',
): boolean {
  void basis;
  if (claim.basis === 'subject_stated') return false;
  const topic = claim.topic;
  if (!topic) return false;
  const official = officialSourceFor(record.url);
  return Boolean(official?.topics.includes(topic));
}

export const ROUTED_SECTION_IDS = [
  'background',
  'education',
  'university-accreditation',
  'licenses',
  'board-actions',
  'board-certifications',
  'certification-orgs',
  'memberships',
  'publications',
  'grants',
  'patents',
  'awards-military',
  'ime',
  'orders',
  'pleadings',
  'depositions',
  'testimony-inconsistencies',
  'income-bias',
  'lawsuits',
  'criminal',
  'corporate',
  'patient-reviews',
  'office-location',
  'admissibility-challenges',
  'university-rules',
  'websites',
  'directories',
  'social',
  'videos',
  'news',
] as const;

export type RoutedSectionId = (typeof ROUTED_SECTION_IDS)[number];

export function isRoutedSection(id: string): id is RoutedSectionId {
  return (ROUTED_SECTION_IDS as readonly string[]).includes(id);
}

export const BASIS_LABEL: Record<WebClaimBasis | 'record', string> = {
  subject_stated: 'Stated by the expert (own website or profile)',
  third_party: 'Stated on a third-party page',
  primary_source:
    'Primary source (the issuing body, a court or an official registry)',
  allegation: 'Reported or alleged; not established',
  record: 'Page that names the expert',
};

export interface RoutedFinding {
  sectionId: RoutedSectionId;
  title: string;
  statement: string;
  quote: string | null;
  url: string;
  sourceTitle: string;
  basis: WebClaimBasis | 'record';
  basisLabel: string;
  matchLevel: 'strong' | 'possible';
  from: 'page' | 'snippet';
  retrievedAt: string;
  publishedAt: string | null;
  /** Comparison with the issuing body, when this kind of claim has one. */
  verification: WebVerification | null;
  rating?: string | null;
  kind?: WebSourceKind;
  searchProviders?: string[];
  read?: WebRecord['read'];
}

const CREDENTIAL_SECTIONS: ReadonlySet<RoutedSectionId> = new Set([
  'education',
  'awards-military',
  'publications',
  'licenses',
  'board-certifications',
  'certification-orgs',
]);

const CREDENTIAL_TOPICS = new Set<string>([
  'education',
  'award',
  'military',
  'publication',
  'license',
  'board_certification',
  'certification_org',
]);

const BASIS_ORDER: Record<WebClaimBasis | 'record', number> = {
  primary_source: 0,
  subject_stated: 1,
  third_party: 2,
  allegation: 3,
  record: 4,
};

/** Report section(s) a topic is filed under. */
const TOPIC_SECTIONS: Partial<Record<WebClaimTopic, RoutedSectionId[]>> = {
  education: ['education'],
  board_certification: ['board-certifications', 'certification-orgs'],
  certification_org: ['certification-orgs'],
  license: ['licenses'],
  membership: ['memberships'],
  publication: ['publications'],
  grant: ['grants'],
  patent: ['patents'],
  award: ['awards-military'],
  military: ['awards-military'],
  employment: ['background'],
  corporate: ['corporate'],
  office: ['office-location'],
  review: ['patient-reviews'],
  advertising: ['ime'],
  ime: ['ime'],
  order: ['orders'],
  pleading: ['pleadings'],
  deposition: ['depositions'],
  testimony: ['testimony-inconsistencies'],
  university_rules: ['university-rules'],
};

const CRIMINAL_RECORD_KINDS: ReadonlySet<WebSourceKind> = new Set([
  'news',
  'court',
  'justia',
  'blog',
]);

/** Topics that must not be inferred from a court filing or Justia page. */
const TOPICS_NOT_FROM_COURT_CLAIMS = new Set<string>([
  'board_certification',
  'certification_org',
  'license',
  'education',
  'ime',
  'advertising',
  'deposition',
  'testimony',
]);

const SECTION_VERIFICATION: Partial<Record<RoutedSectionId, WebClaimTopic>> = {
  'board-certifications': 'board_certification',
  'certification-orgs': 'board_certification',
  memberships: 'membership',
  licenses: 'license',
  publications: 'publication',
  grants: 'grant',
  patents: 'patent',
};

function sectionsFor(claim: WebClaim): RoutedSectionId[] {
  const topic = claim.topic ?? 'other';
  const text = `${claim.text} ${claim.quote}`;
  if (topic === 'discipline' || topic === 'criminal') {
    if (
      topic === 'criminal' ||
      /\b(arrest|convict|criminal|charged|felony|misdemeanor)\w*/i.test(text)
    ) {
      return ['criminal'];
    }
    if (
      /\b(board|licens|sanction|revok|suspen|reprimand|probation|administrative complaint|disciplin)\w*/i.test(
        text,
      )
    ) {
      return ['board-actions'];
    }
    if (/\b(malpractice|lawsuit|sued|complaint|negligen)\w*/i.test(text)) {
      return ['lawsuits'];
    }
    return ['board-actions'];
  }
  const sections = [...(TOPIC_SECTIONS[topic] ?? [])];
  // Fees and rates, whatever page type they appear on.
  if (
    topic !== 'other' &&
    /(\$\s?\d[\d,]*(\.\d+)?|\bper hour\b|\bhourly\b|\bretainer\b)/i.test(
      text,
    ) &&
    /\b(fee|rate|retainer|charge|paid|billing|hourly|per hour)\b/i.test(text)
  ) {
    sections.push('income-bias');
  }
  return sections;
}

function tied(record: WebRecord): record is WebRecord & {
  match: { level: 'strong' | 'possible' };
} {
  return record.match.level === 'strong' || record.match.level === 'possible';
}

function short(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const INSTITUTION_OF =
  /\b(?:University|College|Institute|School) of [A-Z][A-Za-z&-]+(?: (?:at |of )?[A-Z][A-Za-z&-]+){0,3}\b/g;
const INSTITUTION_NAMED =
  /\b(?:[A-Z][A-Za-z&-]+ ){1,3}(?:University|College)\b/g;
const NOT_PART_OF_NAME =
  /^(?:He|She|They|Dr|Mr|Ms|The|Her|His|In|At|And|From|With|After|Before)\s+/;

export function institutionsIn(text: string): string[] {
  const found = new Map<string, string>();
  const take = (raw: string) => {
    let name = raw.replace(/\s+/g, ' ').trim();
    while (NOT_PART_OF_NAME.test(name))
      name = name.replace(NOT_PART_OF_NAME, '');
    if (!/(University|College|Institute|School)/.test(name)) return;
    const key = name.toLowerCase();
    if (!found.has(key)) found.set(key, name);
  };
  for (const match of text.matchAll(INSTITUTION_OF)) take(match[0]);
  for (const match of text.matchAll(INSTITUTION_NAMED)) take(match[0]);
  // "University of West Florida" also contains no second "X University".
  return [...found.values()];
}

const LEGAL_SECTIONS: ReadonlySet<RoutedSectionId> = new Set([
  'orders',
  'pleadings',
  'depositions',
  'testimony-inconsistencies',
]);

/** Sections where several sentences of one page say the same thing. */
const ONE_PER_PAGE: ReadonlySet<RoutedSectionId> = new Set([
  'board-certifications',
  'orders',
  'pleadings',
  'depositions',
  'testimony-inconsistencies',
  'ime',
  'publications',
  'background',
  'licenses',
  'education',
  'office-location',
  'social',
]);

/** A quote that states the credential outright reads better than a bare suffix. */
function strength(quote: string | null): number {
  if (!quote) return 0;
  return (
    (/\bboard[- ]certified\b|\bboard certification\b/i.test(quote) ? 2 : 0) +
    (/\bAmerican (Board|Academy) of\b/i.test(quote) ? 2 : 0) +
    (quote.length > 40 ? 1 : 0)
  );
}

const CAPTION =
  /\b((?:United States|State(?: of [A-Z][a-z]+)?) v\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4}|[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\s+v\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4})/;

/** Case name from a PACER or reporter title; falls back to a short title. */
export function caseCaption(title: string, summary = ''): string {
  const fromTitle = title.match(CAPTION);
  if (fromTitle) return fromTitle[1].replace(/\s+/g, ' ').trim();
  const fromSummary = summary.match(CAPTION);
  if (fromSummary) return fromSummary[1].replace(/\s+/g, ' ').trim();
  if (/UNITED STATES DISTRICT COURT/i.test(title)) {
    const docket = title.match(
      /\b(?:Case\s+)?No\.?\s*[:#]?\s*[\d:-]+[A-Za-z0-9-]*/i,
    );
    return docket
      ? `Federal court record ${docket[0]}`
      : 'Federal court record';
  }
  return short(title, 90);
}

function courtDocumentSection(record: WebRecord): RoutedSectionId | null {
  const text = `${record.title} ${record.url} ${record.summary}`.toLowerCase();
  // A title that opens with "Order on motion…" is an order, not a motion.
  if (
    /^\W*(order|opinion|ruling|judgment|memorandum opinion)\b/i.test(
      record.title,
    )
  ) {
    return 'orders';
  }
  // School-board / OAH due-process materials are orders, not depositions.
  if (
    /\b(oah case|due process hearing|administrative law judge|final order|memorandum (?:and )?order|school board)\b/.test(
      text,
    )
  ) {
    return 'orders';
  }
  // Memorandum opinions / memorandum-and-order titles are orders, not pleadings.
  if (
    /\b(memorandum opinion|memorandum (?:and|&) order|memorandum decision)\b/.test(
      text,
    )
  ) {
    return 'orders';
  }
  if (
    /\b(motion|complaint|petition|brief|affidavit|response in|reply|memorandum (?:in|of|to|for|supporting|opposing))\b/.test(
      text,
    )
  ) {
    return 'pleadings';
  }
  // A notice of deposition is a pleading/notice, not the transcript itself.
  if (/\bnotice of (?:taking )?deposition\b/.test(text)) {
    return 'pleadings';
  }
  // Only transcript-like titles count as depositions.
  if (/\b(deposition of|deposition transcript)\b/.test(text)) {
    return 'depositions';
  }
  if (
    /\b(trial transcript|hearing transcript|testimony transcript)\b/.test(text)
  ) {
    return 'depositions';
  }
  if (
    /\b(order|opinion|ruling|judgment|report and recommendation)\b/.test(text)
  ) {
    return 'orders';
  }
  return null;
}

export interface RouteWebFindingsOptions {
  /** Two-letter state codes for official SOS business-search deep links. */
  stateCodes?: readonly string[];
}

/** Everything the web run found, filed by report section. */
export function routeWebFindings(
  dossier: WebResearchDossier | null | undefined,
  options: RouteWebFindingsOptions = {},
): Map<RoutedSectionId, RoutedFinding[]> {
  const routed = new Map<RoutedSectionId, RoutedFinding[]>();
  if (!dossier) return routed;
  const verifications = dossier.verifications ?? [];
  const verificationFor = (
    section: RoutedSectionId,
  ): WebVerification | null => {
    const topic = SECTION_VERIFICATION[section];
    return topic
      ? (verifications.find((v) => v.topic === topic) ?? null)
      : null;
  };
  const seen = new Set<string>();
  const push = (finding: RoutedFinding) => {
    const key = `${finding.sectionId}|${finding.url}|${(finding.quote ?? finding.statement).toLowerCase().slice(0, 120)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const list = routed.get(finding.sectionId) ?? [];
    list.push(finding);
    routed.set(finding.sectionId, list);
  };

  const orgs = new Map<
    string,
    { label: string; findings: RoutedFinding[]; pages: Set<string> }
  >();

  for (const record of dossier.records) {
    if (!tied(record)) continue;
    if (isIrrelevantNoiseRecord(record)) continue;
    const matchLevel = record.match.level;
    const courtLike = looksLikeCourtDocument(record);
    const base = {
      url: record.url,
      sourceTitle: record.title,
      matchLevel,
      retrievedAt: record.retrievedAt,
      publishedAt: record.publishedAt,
      rating: record.rating ?? null,
      kind: record.kind,
      searchProviders: record.searchProviders,
      read: record.read,
    };
    let claimedDocumentType = false;
    for (const claim of record.claims) {
      const basis = claim.basis ?? 'third_party';
      if (
        claim.topic === 'criminal' &&
        !CRIMINAL_RECORD_KINDS.has(record.kind)
      ) {
        continue;
      }
      if (claim.topic === 'license') {
        const official = officialSourceFor(record.url);
        if (!official?.topics.includes('license')) continue;
      }
      if (claim.topic === 'grant' && record.kind === 'publication') {
        continue;
      }
      // A court filing that mentions "board certified" is not board-certification
      // verification, a license lookup, an IME listing, or a degree record.
      // Applies even when the model retagged kind to news or IME.
      if (courtLike && TOPICS_NOT_FROM_COURT_CLAIMS.has(claim.topic ?? '')) {
        continue;
      }
      if (
        CREDENTIAL_TOPICS.has(claim.topic ?? '') &&
        record.match.level !== 'strong'
      ) {
        continue;
      }
      for (const sectionId of sectionsFor(claim)) {
        if (
          CREDENTIAL_SECTIONS.has(sectionId) &&
          record.match.level !== 'strong'
        ) {
          continue;
        }
        // Forensic/IME marketing belongs under paid directories only. Practice
        // sites (often kind "other") and articles stay under Websites — not
        // IME advertising.
        if (
          (sectionId === 'ime' || claim.topic === 'advertising') &&
          !isPaidDirectoryRecord(record)
        ) {
          push({
            ...base,
            sectionId: 'websites',
            title: `Website: ${short(record.title, 90)}`,
            statement: claim.text,
            quote: claim.quote,
            basis: claim.basis === 'subject_stated' ? 'subject_stated' : basis,
            basisLabel:
              claim.basis === 'subject_stated'
                ? BASIS_LABEL.subject_stated
                : BASIS_LABEL[basis],
            from: claim.from ?? 'page',
            verification: verificationFor('websites'),
          });
          continue;
        }
        // Practice-site publication lists are the expert’s own bibliography,
        // not PubMed/OpenAlex catalog hits — do not fill Publications with them.
        if (
          sectionId === 'publications' &&
          (record.kind === 'expert_website' ||
            record.kind === 'advertising' ||
            record.kind === 'profile')
        ) {
          push({
            ...base,
            sectionId: 'websites',
            title: `Expert’s own publication list: ${short(record.title, 90)}`,
            statement: `${claim.text} This is listed on the expert’s own site or profile. It is not a PubMed/OpenAlex catalog confirmation.`,
            quote: claim.quote,
            basis: 'subject_stated',
            basisLabel: BASIS_LABEL.subject_stated,
            from: claim.from ?? 'page',
            verification: verificationFor('websites'),
          });
          continue;
        }
        // Hard rule: the expert’s own website/CV may be listed as their
        // statement, but must not support board certification or license proof.
        // Only issuing-body / primary_source pages stay in credential sections.
        if (
          (sectionId === 'board-certifications' || sectionId === 'licenses') &&
          !isIssuingBodyCredentialClaim(record, claim, basis)
        ) {
          push({
            ...base,
            sectionId: 'websites',
            title: `Expert’s own statement: ${short(record.title, 90)}`,
            statement: `${claim.text} This is the expert’s own statement (website or profile). It is not independent verification of the credential.`,
            quote: claim.quote,
            // Never keep a “primary source / issuing body” label after the
            // hard rule moves the claim off the credential section.
            basis: 'subject_stated',
            basisLabel: BASIS_LABEL.subject_stated,
            from: claim.from ?? 'page',
            verification: verificationFor('websites'),
          });
          continue;
        }
        // University faculty pages about teaching are not university rules /
        // COI policies unless the claim itself is a policy rule.
        if (
          sectionId === 'university-rules' &&
          claim.topic !== 'university_rules'
        ) {
          continue;
        }
        if (['order', 'pleading', 'deposition'].includes(claim.topic ?? '')) {
          claimedDocumentType = true;
        }
        // Model-tagged "deposition" claims that are only a notice of
        // deposition belong under pleadings, not deposition transcripts.
        if (
          sectionId === 'depositions' &&
          /\bnotice of (?:taking )?deposition\b/i.test(
            `${claim.text} ${claim.quote} ${record.title}`,
          )
        ) {
          push({
            ...base,
            sectionId: 'pleadings',
            title: caseCaption(record.title, record.summary),
            statement: claim.text,
            quote: claim.quote,
            basis,
            basisLabel: BASIS_LABEL[basis],
            from: claim.from ?? 'page',
            verification: null,
          });
          continue;
        }
        if (sectionId === 'certification-orgs') {
          const official = officialSourceFor(record.url);
          for (const org of organizationsIn(`${claim.text} ${claim.quote}`)) {
            // A page is the primary source only for its own organization:
            // the AACN directory does not issue an ABPP certificate.
            const orgBasis: WebClaimBasis =
              basis === 'primary_source' &&
              !(org.acronym && official?.acronyms?.includes(org.acronym))
                ? 'third_party'
                : basis;
            const entry = orgs.get(org.key) ?? {
              label: org.label,
              findings: [],
              pages: new Set<string>(),
            };
            entry.pages.add(record.url);
            entry.findings.push({
              ...base,
              sectionId,
              title: org.label,
              statement: claim.text,
              quote: claim.quote,
              basis: orgBasis,
              basisLabel: BASIS_LABEL[orgBasis],
              from: claim.from ?? 'page',
              verification: verificationFor(sectionId),
            });
            orgs.set(org.key, entry);
          }
          continue;
        }
        const legal = LEGAL_SECTIONS.has(sectionId);
        push({
          ...base,
          sectionId,
          title: legal
            ? caseCaption(record.title, record.summary)
            : `${TOPIC_LABEL[claim.topic ?? 'other']}: ${short(record.title, 90)}`,
          statement: claim.text,
          quote: claim.quote,
          basis,
          basisLabel: BASIS_LABEL[basis],
          from: claim.from ?? 'page',
          verification: verificationFor(sectionId),
        });
      }
    }

    // An official listing page counts for its own sections even when no
    // sentence on it matched a rule.
    const official = officialSourceFor(record.url);
    if (official && record.read === 'read' && record.match.level === 'strong') {
      for (const topic of official.topics) {
        if (topic !== 'certification_org' && topic !== 'board_certification')
          continue;
        const entry = orgs.get(official.id.toUpperCase()) ?? {
          label: official.name,
          findings: [],
          pages: new Set<string>(),
        };
        entry.pages.add(record.url);
        entry.findings.push({
          ...base,
          sectionId: 'certification-orgs',
          title: official.name,
          statement: `${official.name} page that names the expert.`,
          quote: record.match.quote,
          basis: 'primary_source',
          basisLabel: BASIS_LABEL.primary_source,
          from: 'page',
          verification: verificationFor('certification-orgs'),
        });
        orgs.set(official.id.toUpperCase(), entry);
        break;
      }
    }

    // A journal or repository page that names the expert is a publication
    // record even when no single sentence matched a publication rule.
    if (
      record.kind === 'publication' &&
      record.match.level === 'strong' &&
      !record.claims.some((claim) => claim.topic === 'publication')
    ) {
      push({
        ...base,
        sectionId: 'publications',
        title: short(record.title, 140),
        statement: record.summary,
        quote: record.match.quote,
        basis: 'record',
        basisLabel: BASIS_LABEL.record,
        from: record.read === 'read' ? 'page' : 'snippet',
        verification: verificationFor('publications'),
      });
    }

    // Court pages: file by document type when no statement already did.
    if (courtLike && !claimedDocumentType) {
      const sectionId = courtDocumentSection(record);
      if (sectionId) {
        push({
          ...base,
          sectionId,
          title: caseCaption(record.title, record.summary),
          statement: record.summary,
          quote: record.match.quote,
          basis: 'record',
          basisLabel: BASIS_LABEL.record,
          from: record.read === 'read' ? 'page' : 'snippet',
          verification: null,
        });
      }
    }

    // Possible and other-person pages belong under Other people, not the
    // subject's directories, reviews, news, advertising, or social sections.
    // Social URLs require a strong identity match (client: LinkedIn/social
    // must be attributable to the expert).
    if (record.match.level !== 'strong') {
      continue;
    }

    if (record.kind === 'social') {
      const institutional = /\/company\/|\/school\//i.test(record.url);
      const platform = record.platform
        ? record.platform.replace(/^./, (c) => c.toUpperCase())
        : 'Social';
      push({
        ...base,
        sectionId: 'social',
        title: institutional
          ? `Institutional ${platform} page listed in search`
          : record.platform
            ? `${platform} profile`
            : short(record.title, 90),
        statement: institutional
          ? 'A search result listed this as an official or employer social account connected to the expert’s work. It is not a personal profile of the expert. Profile URL found; the page was not opened because it requires sign-in.'
          : record.read === 'read'
            ? `Page was read. ${record.summary}`.trim()
            : 'A public search listed this profile URL. The page itself was not opened because it requires sign-in, so profile content was not independently verified.',
        quote: record.match.quote ?? record.snippet,
        basis: 'record',
        basisLabel: BASIS_LABEL.record,
        from: record.read === 'read' ? 'page' : 'snippet',
        verification: null,
      });
    }

    const alreadyFiled = (sectionId: RoutedSectionId): boolean => {
      const prefix = `${sectionId}|${record.url}|`;
      for (const key of seen) {
        if (key.startsWith(prefix)) return true;
      }
      return false;
    };
    const recordFinding = (
      sectionId: RoutedSectionId,
      title: string,
    ): RoutedFinding => ({
      ...base,
      sectionId,
      title,
      statement: record.summary,
      quote: record.match.quote ?? record.snippet,
      basis: 'record',
      basisLabel: BASIS_LABEL.record,
      from: record.read === 'read' ? 'page' : 'snippet',
      verification: verificationFor(sectionId),
    });
    if (record.kind === 'directory' && !alreadyFiled('directories')) {
      push(recordFinding('directories', short(record.title, 140)));
    }
    if (
      (record.kind === 'video' || record.kind === 'presentation') &&
      !alreadyFiled('videos')
    ) {
      push(recordFinding('videos', short(record.title, 140)));
    }
    if (
      (record.kind === 'advertising' ||
        record.kind === 'ime' ||
        record.kind === 'directory') &&
      !courtLike &&
      isPaidDirectoryRecord(record) &&
      !alreadyFiled('ime')
    ) {
      push(recordFinding('ime', short(record.title, 140)));
    }
    if (record.kind === 'review' && !alreadyFiled('patient-reviews')) {
      push(recordFinding('patient-reviews', short(record.title, 140)));
    }
    if (
      (record.kind === 'news' || record.kind === 'blog') &&
      !alreadyFiled('news')
    ) {
      const newsFrom = record.read === 'read' ? 'page' : 'snippet';
      const newsStatement =
        newsFrom === 'page'
          ? `Article text was read. ${record.summary}`.trim()
          : `RSS/GDELT listing. Article text was not read. ${record.summary}`.trim();
      push({
        ...recordFinding('news', short(record.title, 140)),
        statement: newsStatement,
        from: newsFrom,
      });
    }
    const officialPage = officialSourceFor(record.url);
    if (officialPage?.topics.includes('patent') && !alreadyFiled('patents')) {
      push(recordFinding('patents', short(record.title, 140)));
    }
    if (
      officialPage?.topics.includes('military') &&
      !alreadyFiled('awards-military')
    ) {
      push(recordFinding('awards-military', short(record.title, 140)));
    }
  }

  // One entry per certification organization, however many pages name it.
  for (const entry of orgs.values()) {
    const ordered = [...entry.findings].sort(
      (a, b) =>
        BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis] ||
        strength(b.quote) - strength(a.quote),
    );
    const lead = ordered[0];
    const others = [...entry.pages].filter((url) => url !== lead.url);
    push({
      ...lead,
      statement:
        others.length > 0
          ? `Named on ${entry.pages.size} pages. ${lead.statement}`
          : lead.statement,
      title: entry.label,
    });
    for (const url of others.slice(0, 5)) {
      const extra = ordered.find((f) => f.url === url);
      if (extra) push({ ...extra, title: `${entry.label} (also named here)` });
    }
  }

  // Businesses named on pages that name the expert.
  const companyNames = new Set<string>();
  for (const tie of dossier.companies ?? []) {
    const key = tie.name.toLowerCase();
    const record = dossier.records.find((r) => r.url === tie.url) ?? null;
    const first = !companyNames.has(key);
    companyNames.add(key);
    if (!first && tie.scope !== 'own_page') continue;
    push({
      sectionId: 'corporate',
      title: tie.name,
      statement:
        tie.scope === 'own_page'
          ? `${tie.name} is named with the expert on the expert’s own page (${hostOf(tie.url)}). A practice website is not a Secretary of State record. The role (owner, officer, employer) is not stated unless the quote says so.`
          : `${tie.name} is named near the expert’s name on ${hostOf(tie.url)}. The page does not establish ownership or role and is not a Secretary of State filing.`,
      quote: tie.quote,
      url: tie.url,
      sourceTitle: record?.title ?? hostOf(tie.url),
      basis: tie.scope === 'own_page' ? 'subject_stated' : 'third_party',
      basisLabel:
        BASIS_LABEL[
          tie.scope === 'own_page' ? 'subject_stated' : 'third_party'
        ],
      matchLevel: (record?.match.level as 'strong' | 'possible') ?? 'possible',
      from: 'page',
      retrievedAt: record?.retrievedAt ?? dossier.ranAt,
      publishedAt: record?.publishedAt ?? null,
      verification: null,
    });
  }

  // Official SOS search deep-links for named entities (all states when known).
  // These are entry points for the attorney; automated SOS login was not done.
  const states = (options.stateCodes ?? []).filter(Boolean);
  if (states.length > 0 && companyNames.size > 0) {
    for (const link of sosDeepLinksFor([...companyNames], states)) {
      push({
        sectionId: 'corporate',
        title: `${link.entityName} — ${link.state} Secretary of State search`,
        statement: `Official ${link.state} business-entity search for “${link.entityName}”. Open this registry to confirm the entity name and filing status. This investigation did not complete a Secretary of State login or scrape; the practice website is not SOS proof.`,
        quote: null,
        url: link.searchUrl,
        sourceTitle: `${link.state} Secretary of State`,
        basis: 'record',
        basisLabel: BASIS_LABEL.record,
        matchLevel: 'possible',
        from: 'snippet',
        retrievedAt: dossier.ranAt,
        publishedAt: null,
        verification: null,
      });
    }
  }

  for (const [sectionId, list] of routed) {
    // One entry per page in a section: the strongest statement from it.
    const byPage = new Map<string, RoutedFinding>();
    const perPage = ONE_PER_PAGE.has(sectionId);
    for (const finding of list) {
      const key = perPage
        ? finding.url
        : `${finding.url}|${finding.title}|${finding.quote}`;
      const kept = byPage.get(key);
      if (!kept || strength(finding.quote) > strength(kept.quote)) {
        byPage.set(key, finding);
      }
    }
    list.splice(0, list.length, ...byPage.values());
    list.sort(
      (a, b) =>
        BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis] ||
        (a.from === b.from ? 0 : a.from === 'page' ? -1 : 1) ||
        strength(b.quote) - strength(a.quote) ||
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
    );
    routed.set(sectionId, list.slice(0, 12));
  }
  return routed;
}

/** What each routed section looks for, and which targeted searches fed it. */
const SECTION_SEARCH: Record<
  RoutedSectionId,
  { what: string; topics: readonly string[] }
> = {
  background: { what: 'employment or practice history', topics: ['identity'] },
  education: { what: 'a degree or training', topics: ['education'] },
  'university-accreditation': {
    what: 'a degree-granting institution',
    topics: ['university_accreditation'],
  },
  licenses: { what: 'a professional license', topics: ['license'] },
  'board-actions': {
    what: 'a licensing board action or complaint',
    topics: ['discipline'],
  },
  'board-certifications': {
    what: 'a board certification',
    topics: ['certification', 'certification_org'],
  },
  'certification-orgs': {
    what: 'a certifying or listing organization',
    topics: ['certification_org', 'certification'],
  },
  memberships: { what: 'a professional membership', topics: ['memberships'] },
  publications: { what: 'a publication', topics: ['publications'] },
  grants: { what: 'a research grant', topics: ['grants'] },
  patents: { what: 'a patent or trademark', topics: ['patents'] },
  'awards-military': {
    what: 'an award, honor or military service',
    topics: ['awards', 'military_claims'],
  },
  ime: {
    what: 'IME or expert-services advertising',
    topics: ['ime', 'advertising', 'directories'],
  },
  orders: {
    what: 'a court order naming the expert',
    topics: ['court_documents', 'litigation'],
  },
  pleadings: {
    what: 'a motion or pleading naming the expert',
    topics: ['court_documents', 'litigation'],
  },
  depositions: {
    what: 'a deposition or testimony transcript',
    topics: ['depositions'],
  },
  'testimony-inconsistencies': {
    what: 'testimony or a transcript to compare',
    topics: ['depositions', 'litigation'],
  },
  'income-bias': {
    what: 'fees, rates or retention figures',
    topics: ['ime', 'advertising'],
  },
  lawsuits: {
    what: 'a lawsuit or malpractice claim',
    topics: ['litigation', 'discipline'],
  },
  criminal: { what: 'a criminal record', topics: ['criminal'] },
  corporate: { what: 'a business tie', topics: ['business'] },
  'patient-reviews': {
    what: 'a patient or client review',
    topics: ['reviews'],
  },
  'office-location': {
    what: 'an office address',
    topics: ['places'],
  },
  'admissibility-challenges': {
    what: 'a Daubert, Frye or Rule 702 challenge',
    topics: ['litigation', 'court_documents'],
  },
  'university-rules': {
    what: 'a university rule or policy that applies to the expert',
    topics: ['university_rules'],
  },
  websites: { what: 'an expert or practice website', topics: ['identity'] },
  directories: {
    what: 'an expert directory listing',
    topics: ['directories'],
  },
  social: { what: 'a social media profile', topics: ['social'] },
  videos: { what: 'a video, podcast or transcript', topics: ['video'] },
  news: {
    what: 'a news article or blog post',
    topics: ['news', 'news_adverse'],
  },
};

export function sectionVerification(
  dossier: WebResearchDossier | null | undefined,
  sectionId: string,
): WebVerification | null {
  if (!dossier || !isRoutedSection(sectionId)) return null;
  const topic = SECTION_VERIFICATION[sectionId];
  return topic
    ? ((dossier.verifications ?? []).find((v) => v.topic === topic) ?? null)
    : null;
}

const NOT_SEARCHED =
  'No dedicated search was run for this topic in this investigation.';
const SEARCH_INCOMPLETE =
  'The search for this topic did not complete, so no finding is reported.';
const TOPIC_SEARCHED_EMPTY =
  'A dedicated search for this topic ran and returned no matching public result. That is not proof that none exist.';
const PRIOR_NOT_REUSED =
  'Results from other investigations are not reused or revalidated here.';
const BUDGET_OMITTED =
  'This category was planned but not searched because the query budget or time limit was reached. That is not proof that nothing exists.';
/** Empty university-rules copy: section is about outside-income / forensic consulting rules. */
export const UNIVERSITY_RULES_EMPTY =
  'This section covers university rules on outside income and forensic or consulting work. Some universities permit employees to take forensic cases and keep the fee, but they publish rules on how that work is disclosed or approved, and those policies may be discoverable. No public conflict-of-interest, outside-activity, or consulting policy page for this expert’s appointment was retrieved in this investigation. The expert’s own CV or practice site is not a university rule. Unrelated alumni articles are not filed here.';
const NOT_IMPLEMENTED_LINE = /is not implemented in this investigation/i;

/** Public search ran; official database login or dedicated API was not used. */
const PUBLIC_SEARCH_LIMIT: Partial<Record<RoutedSectionId, string>> = {
  patents:
    'A public web search for patents and trademarks was performed. Official USPTO verification through a dedicated database login was not completed.',
  'awards-military':
    'A public web search for awards, medals and military-service claims was performed. Official military verification was not completed.',
  directories:
    'Public directory pages were searched. Login-gated member databases, including the DRI members-only area, were not accessed.',
  ime: 'A public search for paid expert-directory and IME advertising listings was performed. The expert’s own practice website is reported under Websites, not as advertising. Paid expert-referral databases were not accessed.',
  lawsuits:
    'A public web search for court records naming the expert was performed. That is not a comprehensive malpractice or lawsuit search. Paid docket databases were not queried.',
  criminal:
    'A public news and web search for criminal-record mentions was performed. Dedicated criminal-record databases were not queried. This is not a comprehensive criminal-records search.',
  depositions:
    'A public web search for deposition or testimony transcripts naming the expert was performed. Paid transcript databases (for example TrialSmith) were not accessed. Finding a docket notice that mentions a deposition is not the same as retrieving the transcript.',
  'testimony-inconsistencies':
    'A public web search for testimony and Daubert, Frye, or Rule 702 mentions was performed. Mentions of testimony are not transcript text. Paid transcript libraries (TrialSmith, Lexis) are listed only when those sources are configured for this investigation.',
  orders:
    'A public web search for court orders naming the expert was performed. PACER paid downloads and complete dockets were not retrieved. School-board and administrative (OAH) orders are listed here when found; they are not deposition transcripts.',
  pleadings:
    'A public web search for motions and pleadings naming the expert was performed. PACER paid downloads and complete dockets were not retrieved.',
  'admissibility-challenges':
    'A public web search for Daubert, Frye, and Rule 702 mentions was performed. This is not a complete docket review.',
  news: 'Public news search included web and Google News results when those providers ran. A missing article is not proof that none exist.',
  social:
    'Public search looked for LinkedIn, Facebook, Instagram, X (Twitter), TikTok, YouTube channel, and Bluesky profiles. Only profiles strongly matched to the expert are listed. Login-gated pages were not opened, so profile content was not independently verified.',
  corporate:
    'A public web search for corporate-registry mentions was performed. Book publishers and journal houses named on publication pages are not treated as corporate affiliations. Official secretary-of-state logins were not completed.',
  'patient-reviews':
    'Public review-site listings were searched when found. When a rating or review page was retrieved, the URL and any rating shown on that page are listed. Patient reviews are third-party opinions, not independently verified clinical facts. If a review site blocked automated reading, that page is listed as unread by the software — not as a comprehensive patient-review file.',
  'university-accreditation':
    'Official accreditation look-ups (CHEA, U.S. Department of Education College Navigator, and APA CoA program lists when an institution was identified) were searched on the public web. Each query and any resulting page URL are listed when available. That is not a paid official accreditation-database login.',
};

function blockedNote(
  dossier: WebResearchDossier,
  sectionId: RoutedSectionId,
): string | null {
  const hosts: Partial<Record<RoutedSectionId, RegExp>> = {
    publications: /researchgate\.net|pubmed|pmc\.ncbi/i,
    grants: /reporter\.nih\.gov|researchgate\.net/i,
    licenses: /doh\.state\.fl\.us|flhealthsource/i,
    patents: /uspto\.gov|patents\.google/i,
  };
  const pattern = hosts[sectionId];
  if (!pattern) return null;
  const hit = dossier.pagesBlocked.find((page) => pattern.test(page.url));
  if (!hit) return null;
  return 'A source that may hold information for this section could not be read (login, bot protection or robots.txt).';
}

function webRunAttempted(dossier: WebResearchDossier): boolean {
  return dossier.providers.some((provider) => provider.requests > 0);
}

function webRunWorked(dossier: WebResearchDossier): boolean {
  return dossier.providers.some(
    (provider) =>
      provider.requests > 0 && provider.failedRequests < provider.requests,
  );
}

function topicQueriesForSection(
  dossier: WebResearchDossier,
  sectionId: RoutedSectionId,
): number {
  if (sectionId === 'university-accreditation') {
    const hosts = (dossier.executedQueries ?? []).filter((entry) =>
      /site:chea\.org|site:ope\.ed\.gov|site:accreditation\.apa\.org|site:apa\.org/.test(
        entry.query,
      ),
    ).length;
    if (hosts > 0) return hosts;
  }
  if (!dossier.topics) return 0;
  const wanted = SECTION_SEARCH[sectionId].topics;
  return dossier.topics
    .filter((entry) => wanted.includes(entry.topic))
    .reduce((sum, entry) => sum + entry.queries, 0);
}

function topicOmittedForSection(
  dossier: WebResearchDossier,
  sectionId: RoutedSectionId,
): boolean {
  const wanted = SECTION_SEARCH[sectionId].topics;
  if (wanted.length === 0) return false;
  return (dossier.omittedTopics ?? []).some((entry) =>
    wanted.includes(entry.topic),
  );
}

export function displayStructuredCoverage(
  dossier: WebResearchDossier | null | undefined,
  sectionId: string,
  structured: string[],
): string[] {
  if (!isRoutedSection(sectionId)) return structured;
  const queried =
    !!dossier &&
    webRunWorked(dossier) &&
    topicQueriesForSection(dossier, sectionId) > 0;
  if (!queried) return structured;
  return structured.filter((line) => !NOT_IMPLEMENTED_LINE.test(line));
}

/**
 * Empty-section copy. A global web run is not treated as a search of every
 * category. Dedicated source lines (structured) speak for themselves.
 */
export function publicSearchNote(
  dossier: WebResearchDossier | null | undefined,
  sectionId: string,
): string | null {
  if (!dossier || !isRoutedSection(sectionId) || !webRunWorked(dossier)) {
    return null;
  }
  if (topicQueriesForSection(dossier, sectionId) === 0) return null;
  return PUBLIC_SEARCH_LIMIT[sectionId] ?? null;
}

/** Shown when a section has findings from the global run but no dedicated topic search. */
export function findingsCoverageNote(
  dossier: WebResearchDossier | null | undefined,
  sectionId: string,
): string | null {
  if (!dossier || !isRoutedSection(sectionId) || !webRunWorked(dossier)) {
    return null;
  }
  if (topicQueriesForSection(dossier, sectionId) > 0) return null;
  return 'These pages were found during the general web search. A dedicated search for this topic was not run.';
}

export function coverageLine(
  dossier: WebResearchDossier | null | undefined,
  sectionId: string,
  structured: string[] = [],
  expertName?: string,
): string {
  void expertName;
  if (!isRoutedSection(sectionId)) {
    return structured.length > 0 ? structured.join(' ') : NOT_SEARCHED;
  }
  const parts: string[] = [];
  const attempted = Boolean(dossier && webRunAttempted(dossier));
  const worked = Boolean(dossier && webRunWorked(dossier));
  const queried =
    !!dossier && worked && topicQueriesForSection(dossier, sectionId) > 0;
  const omitted = Boolean(
    dossier && topicOmittedForSection(dossier, sectionId),
  );
  const display = displayStructuredCoverage(dossier, sectionId, structured);
  if (attempted && !worked) {
    parts.push(SEARCH_INCOMPLETE);
  } else if (display.length === 0) {
    if (sectionId === 'university-rules') {
      // Always explain the section purpose (outside income / forensic consulting
      // rules). Do not say "Not applicable" or treat the expert’s CV as a policy.
      parts.push(UNIVERSITY_RULES_EMPTY);
      if (omitted) parts.push(BUDGET_OMITTED);
      else if (!queried && attempted) parts.push(NOT_SEARCHED);
    } else if (queried) {
      if (sectionId === 'lawsuits') {
        parts.push(
          'No relevant records identified that qualify as a lawsuit or malpractice claim against this expert. An opinion, motion, or appointment that names the expert is not a lawsuit against the expert.',
        );
      } else if (sectionId === 'university-accreditation') {
        parts.push(
          'Dedicated accreditation queries ran (CHEA, U.S. Department of Education, and/or APA CoA when an institution was known). No matching public accreditation listing was returned for those queries. That is not proof the school was unaccredited.',
        );
        const trail = accreditationQueryTrail(dossier);
        if (trail) parts.push(trail);
      } else {
        parts.push(TOPIC_SEARCHED_EMPTY);
      }
      if (sectionId === 'videos') parts.push(PRIOR_NOT_REUSED);
    } else {
      parts.push(omitted ? BUDGET_OMITTED : NOT_SEARCHED);
    }
  }
  const limit = publicSearchNote(dossier, sectionId);
  if (limit) parts.push(limit);
  if (
    sectionId === 'university-accreditation' &&
    dossier &&
    !parts.some((part) => /Queries run:/i.test(part))
  ) {
    const trail = accreditationQueryTrail(dossier);
    if (trail) parts.push(trail);
  }
  if (dossier) {
    const blocked = blockedNote(dossier, sectionId);
    if (blocked) parts.push(blocked);
  }
  parts.push(...display);
  return parts.join(' ');
}

/** Lists accreditation queries actually executed so the report shows how/where. */
function accreditationQueryTrail(
  dossier: WebResearchDossier | null | undefined,
): string | null {
  if (!dossier?.executedQueries?.length) return null;
  const queries = dossier.executedQueries
    .filter(
      (entry) =>
        entry.topic === 'university_accreditation' ||
        /site:chea\.org|site:ope\.ed\.gov|site:accreditation\.apa\.org|site:apa\.org/.test(
          entry.query,
        ),
    )
    .map((entry) => entry.query);
  if (queries.length === 0) return null;
  const unique = [...new Set(queries)].slice(0, 8);
  const hits = dossier.records
    .filter(
      (record) =>
        record.match.level === 'strong' || record.match.level === 'possible',
    )
    .filter((record) =>
      /chea\.org|ope\.ed\.gov|accreditation\.apa\.org|apa\.org\/ed\/accreditation/i.test(
        record.url,
      ),
    )
    .map((record) => record.url);
  const hitLine =
    hits.length > 0
      ? ` Result URL(s): ${[...new Set(hits)].slice(0, 5).join('; ')}.`
      : ' No official accreditation result URL was returned for those queries.';
  return `Queries run: ${unique.join(' | ')}.${hitLine}`;
}
