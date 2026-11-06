import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
} from '@integrations/expert-research';
import {
  canonicalUrl,
  type WebResearchDossier,
} from '@integrations/web-research';
import type {
  ReportBlock,
  ReportDocumentModel,
} from '@platform/report/report-document';
import type { CvCheck } from '../cv/cv.types';
import type { DirectoryAdvertisingDossier } from '../research/directories';
import type { BoardCertificationDossier } from '../research/board-certifications';
import type { AffiliationDossier } from '../research/affiliations';
import type { MembershipDossier } from '../research/memberships';
import type { AccreditationDossier } from '../research/accreditation';
import { sourceAccessLabel } from './report-wording';
import {
  EWI_REPORT_DISCLAIMER,
  EWI_REPORT_TEMPLATE_VERSION,
} from './ewi-report.version';

export interface SourceLinksInput {
  expertName: string;
  city: string;
  specialty: string;
  generatedAt: string;
  evidence?: ExpertEvidenceItem[];
  identity?: ExpertIdentityResolution | null;
  cvCheck?: CvCheck | null;
  webResearch?: WebResearchDossier | null;
  directoryAssessments?: DirectoryAdvertisingDossier | null;
  boardCertificationAssessments?: BoardCertificationDossier | null;
  affiliationAssessments?: AffiliationDossier | null;
  membershipAssessments?: MembershipDossier | null;
  accreditation?: AccreditationDossier | null;
}

export const EWI_SOURCE_LINKS_TEMPLATE_ID = 'ewi/source-links';

export interface ReportSourceLink {
  title: string;
  url: string;
  category: string;
  /** How the URL is tied to the subject. */
  attribution: 'subject' | 'possible' | 'other';
  /** Access/read note; not a verification claim. */
  access?: string;
}

function sourceUrlKey(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return canonicalUrl(parsed.toString());
  } catch {
    return null;
  }
}

function categoryLabel(value: string | undefined): string {
  if (!value?.trim()) return 'Uncategorized';
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function addLink(
  byKey: Map<string, ReportSourceLink>,
  url: string | undefined,
  title: string | undefined,
  category: string | undefined,
  attribution: ReportSourceLink['attribution'] = 'subject',
  access?: string,
): void {
  if (!url) return;
  const key = sourceUrlKey(url);
  if (!key) return;
  const existing = byKey.get(key);
  if (existing) return;
  byKey.set(key, {
    url: key,
    title: title?.trim() || key,
    category: categoryLabel(category),
    attribution,
    ...(access ? { access } : {}),
  });
}

function webAccess(read: string | undefined): string | undefined {
  if (read === 'read') return 'page content read';
  if (read === 'snippet_only') return 'search result only';
  if (read === 'restricted' || read === 'failed' || read === 'not_read') {
    return 'not read (login or bot protection)';
  }
  return undefined;
}

function webAttribution(
  level: string | undefined,
): ReportSourceLink['attribution'] | null {
  if (level === 'strong') return 'subject';
  if (level === 'possible') return 'possible';
  if (level === 'other_person' || level === 'weak') return 'other';
  return null;
}

/**
 * Unique http(s) source URLs from the investigation record, first-seen
 * order then sorted by category and title. Duplicates from evidence, CV
 * comparison, identity, and web research collapse to one row.
 */
export function uniqueSourceLinks(
  input: Pick<
    SourceLinksInput,
    | 'evidence'
    | 'identity'
    | 'cvCheck'
    | 'webResearch'
    | 'directoryAssessments'
    | 'boardCertificationAssessments'
    | 'affiliationAssessments'
    | 'membershipAssessments'
    | 'accreditation'
  >,
): ReportSourceLink[] {
  const byKey = new Map<string, ReportSourceLink>();
  for (const item of input.evidence ?? []) {
    addLink(
      byKey,
      item.url ?? item.source?.url,
      item.title,
      item.category || item.sourceId,
      item.identityMatch === 'uncertain' ? 'possible' : 'subject',
      sourceAccessLabel(item),
    );
  }
  for (const assessment of input.directoryAssessments?.assessments ?? []) {
    if (!assessment.profileUrl) continue;
    addLink(
      byKey,
      assessment.profileUrl,
      assessment.evidence?.title ||
        `${assessment.directoryName}${
          assessment.evidence?.searchResultOnly
            ? ' (search result)'
            : ' profile'
        }`,
      assessment.evidence?.searchResultOnly
        ? 'Expert Directory Search Result'
        : 'Expert Directory',
      assessment.status === 'profile_found'
        ? 'subject'
        : assessment.status === 'potential_match_unconfirmed'
          ? 'possible'
          : 'subject',
      assessment.evidence?.searchResultOnly
        ? 'search result only'
        : 'page content read',
    );
  }
  for (const assessment of input.boardCertificationAssessments?.assessments ??
    []) {
    const url = assessment.evidence?.url ?? assessment.verificationUrl;
    if (!url) continue;
    addLink(
      byKey,
      url,
      assessment.evidence?.title ||
        `${assessment.boardCanonical ?? 'Board certification'}${
          assessment.evidence?.searchResultOnly
            ? ' (search result)'
            : ' verification'
        }`,
      assessment.evidence?.searchResultOnly
        ? 'Board Certification Search Result'
        : 'Board Certification',
      assessment.status === 'verified' ||
        assessment.status === 'partially_verified'
        ? 'subject'
        : assessment.status === 'potential_match_unconfirmed'
          ? 'possible'
          : 'subject',
      assessment.evidence?.searchResultOnly
        ? 'search result only'
        : 'page content read',
    );
  }
  for (const assessment of input.affiliationAssessments?.assessments ?? []) {
    const url = assessment.evidence?.url;
    if (!url) continue;
    const training = Boolean(assessment.evidence?.trainingDocument);
    addLink(
      byKey,
      url,
      assessment.evidence?.title ||
        `${assessment.institutionCanonical ?? 'Institution'}${
          training
            ? ' (training / practicum)'
            : assessment.evidence?.searchResultOnly
              ? ' (search result)'
              : ' affiliation'
        }`,
      training
        ? 'Training Or Practicum Source'
        : assessment.evidence?.searchResultOnly
          ? 'Affiliation Search Result'
          : 'Institutional Affiliation',
      assessment.status === 'independently_verified' ||
        assessment.status === 'historical_appointment_verified' ||
        assessment.status === 'training_or_practicum_confirmed' ||
        assessment.status === 'partially_verified'
        ? 'subject'
        : assessment.status === 'potential_match_unconfirmed'
          ? 'possible'
          : 'subject',
      assessment.evidence?.searchResultOnly
        ? 'search result only'
        : 'page content read',
    );
  }
  for (const assessment of input.membershipAssessments?.assessments ?? []) {
    const url =
      assessment.evidence?.url ??
      assessment.directoryUrl ??
      assessment.officialWebsite;
    if (!url) continue;
    addLink(
      byKey,
      url,
      assessment.evidence?.title ||
        `${assessment.organizationCanonical ?? assessment.entry.organization ?? 'Membership'}${
          assessment.evidence ? ' membership' : ' directory'
        }`,
      assessment.evidence
        ? 'Professional Membership'
        : 'Professional Membership Directory',
      assessment.status === 'verified' ||
        assessment.status === 'partially_verified'
        ? 'subject'
        : 'subject',
      assessment.evidence ? 'page content read' : undefined,
    );
  }
  for (const assessment of input.accreditation?.assessments ?? []) {
    for (const hit of [
      assessment.apaEvidence,
      assessment.institutionalEvidence,
    ]) {
      if (!hit?.url) continue;
      addLink(
        byKey,
        hit.url,
        hit.title ||
          `${assessment.entry.institution ?? 'Institution'} (${
            hit.kind === 'apa_program' ? 'APA CoA' : 'institutional'
          })`,
        hit.kind === 'apa_program'
          ? 'Apa Program Accreditation'
          : 'Institutional Accreditation',
        'subject',
        'page content read',
      );
    }
  }
  const identity = input.identity;
  if (identity?.identity) {
    addLink(
      byKey,
      identity.identity.url,
      identity.identity.name,
      'NPI Registry',
      'subject',
    );
  }
  for (const comparison of input.cvCheck?.comparisons ?? []) {
    addLink(
      byKey,
      comparison.source?.url,
      comparison.source?.name || comparison.title,
      comparison.topic,
      'subject',
    );
  }
  for (const record of input.webResearch?.records ?? []) {
    const attribution = webAttribution(record.match.level);
    if (!attribution || attribution !== 'subject') continue;
    addLink(
      byKey,
      record.url,
      record.title,
      record.kind,
      'subject',
      webAccess(record.read),
    );
    addLink(
      byKey,
      record.archiveUrl,
      record.title,
      record.kind,
      'subject',
      webAccess(record.read),
    );
  }
  for (const candidate of identity?.candidates ?? []) {
    addLink(byKey, candidate.url, candidate.name, 'NPI Registry', 'possible');
  }
  for (const record of input.webResearch?.records ?? []) {
    const attribution = webAttribution(record.match.level);
    if (attribution !== 'possible') continue;
    addLink(
      byKey,
      record.url,
      record.title,
      `${record.kind} (possible match)`,
      'possible',
      webAccess(record.read),
    );
  }
  for (const record of input.webResearch?.records ?? []) {
    const attribution = webAttribution(record.match.level);
    if (attribution !== 'other') continue;
    addLink(
      byKey,
      record.url,
      record.title,
      `${record.kind} (not this person)`,
      'other',
      webAccess(record.read),
    );
  }
  for (const registry of input.webResearch?.registries ?? []) {
    addLink(byKey, registry.url, registry.name, registry.id, 'subject');
  }
  const portrait = input.webResearch?.portrait;
  if (portrait?.sourceUrl) {
    addLink(
      byKey,
      portrait.sourceUrl,
      'Cover photograph source',
      'Photograph',
      'subject',
    );
  }
  const rank = { subject: 0, possible: 1, other: 2 };
  return [...byKey.values()].sort((left, right) => {
    const byAttr = rank[left.attribution] - rank[right.attribution];
    if (byAttr !== 0) return byAttr;
    const byCategory = left.category.localeCompare(right.category);
    if (byCategory !== 0) return byCategory;
    return left.title.localeCompare(right.title);
  });
}

function isOwnedWebsiteCategory(category: string): boolean {
  return /expert\s*website|professional\s*website|ime\s*website/i.test(
    category,
  );
}

function hostOfLink(url: string): string | null {
  try {
    return new URL(canonicalUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function pathOfLink(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return url;
  }
}

/**
 * Presentational grouping: owned-website paths on one host become one primary
 * row with “Also:” paths. Unique URL counts are unchanged.
 */
function groupOwnedWebsiteLinksForDisplay(
  links: ReportSourceLink[],
): Array<
  | { kind: 'single'; link: ReportSourceLink }
  | { kind: 'host'; host: string; primary: ReportSourceLink; pages: ReportSourceLink[] }
> {
  const ownedByHost = new Map<string, ReportSourceLink[]>();
  const rest: ReportSourceLink[] = [];
  for (const link of links) {
    if (!isOwnedWebsiteCategory(link.category)) {
      rest.push(link);
      continue;
    }
    const host = hostOfLink(link.url);
    if (!host) {
      rest.push(link);
      continue;
    }
    const bucket = ownedByHost.get(host) ?? [];
    bucket.push(link);
    ownedByHost.set(host, bucket);
  }
  const out: Array<
    | { kind: 'single'; link: ReportSourceLink }
    | {
        kind: 'host';
        host: string;
        primary: ReportSourceLink;
        pages: ReportSourceLink[];
      }
  > = [];
  for (const [host, pages] of [...ownedByHost.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (pages.length === 1) {
      out.push({ kind: 'single', link: pages[0] });
    } else {
      const homeIdx = pages.findIndex((p) => pathOfLink(p.url) === '/');
      const ordered =
        homeIdx > 0
          ? [pages[homeIdx], ...pages.filter((_, i) => i !== homeIdx)]
          : pages;
      out.push({
        kind: 'host',
        host,
        primary: ordered[0],
        pages: ordered,
      });
    }
  }
  for (const link of rest) {
    out.push({ kind: 'single', link });
  }
  return out;
}

export function buildEwiSourceLinksDocument(
  input: SourceLinksInput,
): ReportDocumentModel {
  const links = uniqueSourceLinks(input);
  const subject = links.filter((link) => link.attribution === 'subject');
  const possible = links.filter((link) => link.attribution === 'possible');
  const other = links.filter((link) => link.attribution === 'other');
  const blocks: ReportBlock[] = [
    {
      text: `Unique source URLs collected for ${input.expertName}. Each address appears once. Expert-owned website pages on the same domain are listed under one host with page paths underneath. This list is generated from the investigation record; it is not a new search. A URL here is not proof that the page was read or independently verified.`,
      style: 'note',
    },
    {
      text: `${subject.length} subject source(s); ${possible.length} possible match(es); ${other.length} other-person or unconfirmed page(s). ${links.length} unique URL(s) in total.`,
      style: 'note',
    },
  ];
  const writeGroup = (
    heading: string,
    note: string,
    group: ReportSourceLink[],
    start: number,
  ): number => {
    if (group.length === 0) return start;
    blocks.push({ text: heading, style: 'subheading' });
    blocks.push({ text: note, style: 'note' });
    const display = groupOwnedWebsiteLinksForDisplay(group);
    let index = start;
    for (const entry of display) {
      if (entry.kind === 'host') {
        blocks.push({
          text: `${index}. [Expert Website] ${entry.host}`,
          style: 'item',
        });
        blocks.push({
          text: `Category: Expert Website.${entry.primary.access ? ` Access: ${entry.primary.access}.` : ''}`,
          style: 'citation',
        });
        blocks.push({
          text: entry.primary.url,
          link: entry.primary.url,
          style: 'citation',
        });
        const paths = entry.pages
          .slice(1)
          .map((p) => pathOfLink(p.url))
          .filter((p) => p && p !== '/');
        if (paths.length > 0) {
          blocks.push({
            text: `Also: ${[...new Set(paths)].slice(0, 8).join(', ')}`,
            style: 'note',
          });
          for (const page of entry.pages.slice(1).slice(0, 8)) {
            blocks.push({
              text: page.url,
              link: page.url,
              style: 'citation',
            });
          }
        }
        index += 1;
      } else {
        blocks.push({
          text: `${index}. ${entry.link.title}`,
          style: 'item',
        });
        blocks.push({
          text: `Category: ${entry.link.category}.${entry.link.access ? ` Access: ${entry.link.access}.` : ''}`,
          style: 'citation',
        });
        blocks.push({
          text: entry.link.url,
          link: entry.link.url,
          style: 'citation',
        });
        index += 1;
      }
    }
    return index;
  };
  if (links.length === 0) {
    blocks.push({
      text: 'No source URLs were collected.',
      style: 'note',
    });
  } else {
    let next = 1;
    next = writeGroup(
      'Sources tied to this expert',
      'Strong identity match, confirmed NPI, or collected evidence attributed to the subject.',
      subject,
      next,
    );
    next = writeGroup(
      'Possible matches',
      'The name or specialty only partly agrees. These are not treated as the subject’s credentials.',
      possible,
      next,
    );
    writeGroup(
      'Other people or unconfirmed pages',
      'Kept for audit. Not attributed to the subject. The URL and the reason for exclusion are listed.',
      other,
      next,
    );
  }
  const safeName = input.expertName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return {
    product: 'ewi',
    templateId: EWI_SOURCE_LINKS_TEMPLATE_ID,
    templateVersion: EWI_REPORT_TEMPLATE_VERSION,
    title: 'Expert Witness Investigation Source Links',
    subtitle: [input.expertName, input.city.trim(), input.specialty]
      .filter(Boolean)
      .join(' — '),
    headerLabel: 'Expert Witness Investigation',
    fileName: `ewi-${safeName || 'expert'}-source-links.pdf`,
    generatedAt: input.generatedAt,
    mimeType: 'application/pdf',
    format: 'pdf',
    includeTableOfContents: false,
    sections: [
      {
        id: 'source-links',
        title: 'Source Links',
        icon: 'link',
        blocks,
      },
    ],
    highlights: [
      `${subject.length} subject source(s)`,
      `${possible.length} possible match(es)`,
      `${other.length} other-person page(s)`,
    ],
    metadata: {
      expertName: input.expertName,
      city: input.city,
      specialty: input.specialty,
      investigationDate: input.generatedAt.slice(0, 10),
      reportVersion: EWI_REPORT_TEMPLATE_VERSION,
      templateId: EWI_SOURCE_LINKS_TEMPLATE_ID,
      product: 'ewi',
      disclaimer: EWI_REPORT_DISCLAIMER,
    },
  };
}
