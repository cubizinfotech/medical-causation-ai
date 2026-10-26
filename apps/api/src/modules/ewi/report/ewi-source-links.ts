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
  });
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
    );
  }
  const identity = input.identity;
  if (identity?.identity) {
    addLink(
      byKey,
      identity.identity.url,
      identity.identity.name,
      'NPI Registry',
    );
  }
  for (const candidate of identity?.candidates ?? []) {
    addLink(byKey, candidate.url, candidate.name, 'NPI Registry');
  }
  for (const comparison of input.cvCheck?.comparisons ?? []) {
    addLink(
      byKey,
      comparison.source?.url,
      comparison.source?.name || comparison.title,
      comparison.topic,
    );
  }
  for (const record of input.webResearch?.records ?? []) {
    addLink(byKey, record.url, record.title, record.kind);
    addLink(byKey, record.archiveUrl, record.title, record.kind);
  }
  for (const registry of input.webResearch?.registries ?? []) {
    addLink(byKey, registry.url, registry.name, registry.id);
  }
  const portrait = input.webResearch?.portrait;
  if (portrait?.sourceUrl) {
    addLink(byKey, portrait.sourceUrl, 'Cover photograph source', 'Photograph');
  }
  return [...byKey.values()].sort((left, right) => {
    const byCategory = left.category.localeCompare(right.category);
    if (byCategory !== 0) return byCategory;
    return left.title.localeCompare(right.title);
  });
}

export function buildEwiSourceLinksDocument(
  input: SourceLinksInput,
): ReportDocumentModel {
  const links = uniqueSourceLinks(input);
  const blocks: ReportBlock[] = [
    {
      text: `Unique source URLs collected for ${input.expertName}. Each address appears once. This list is generated from the investigation record; it is not a new search.`,
      style: 'note',
    },
    {
      text:
        links.length === 1
          ? '1 unique source link.'
          : `${links.length} unique source links.`,
      style: 'note',
    },
  ];
  if (links.length === 0) {
    blocks.push({
      text: 'No source URLs were collected.',
      style: 'note',
    });
  } else {
    links.forEach((link, index) => {
      blocks.push({
        text: `${index + 1}. ${link.title}`,
        style: 'item',
      });
      blocks.push({
        text: `Category: ${link.category}.`,
        style: 'citation',
      });
      blocks.push({
        text: link.url,
        link: link.url,
        style: 'citation',
      });
    });
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
      links.length === 1
        ? '1 unique source link'
        : `${links.length} unique source links`,
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
