import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
} from '@integrations/expert-research';
import type { WebResearchDossier } from '@integrations/web-research';
import type {
  ReportBlock,
  ReportDocumentModel,
} from '@platform/report/report-document';
import type { CvCheck } from '../cv/cv.types';
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
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) {
        parsed.searchParams.delete(key);
      }
    }
    let href = parsed.toString();
    if (parsed.pathname !== '/' && href.endsWith('/')) {
      href = href.slice(0, -1);
    }
    return href;
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
    'evidence' | 'identity' | 'cvCheck' | 'webResearch'
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

export function buildEwiSourceLinksDocument(
  input: SourceLinksInput,
): ReportDocumentModel {
  const links = uniqueSourceLinks(input);
  const subject = links.filter((link) => link.attribution === 'subject');
  const possible = links.filter((link) => link.attribution === 'possible');
  const other = links.filter((link) => link.attribution === 'other');
  const blocks: ReportBlock[] = [
    {
      text: `Unique source URLs collected for ${input.expertName}. Each address appears once. This list is generated from the investigation record; it is not a new search. A URL here is not proof that the page was read or independently verified.`,
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
    group.forEach((link, index) => {
      blocks.push({
        text: `${start + index}. ${link.title}`,
        style: 'item',
      });
      blocks.push({
        text: `Category: ${link.category}.${link.access ? ` Access: ${link.access}.` : ''}`,
        style: 'citation',
      });
      blocks.push({
        text: link.url,
        link: link.url,
        style: 'citation',
      });
    });
    return start + group.length;
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
