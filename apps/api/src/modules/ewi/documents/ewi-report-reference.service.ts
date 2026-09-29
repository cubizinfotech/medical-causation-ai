import { Injectable } from '@nestjs/common';
import { EWI_REPORT_SECTIONS } from '../report/ewi-report.template';
import { EwiDocumentIntakeService } from './ewi-document-intake.service';
import type {
  EwiEvidenceDocument,
  EwiEvidenceReference,
  EwiReportReferenceEntry,
  EwiReportReferenceIndex,
} from './ewi-evidence-reference.types';

const KIND_TO_SECTIONS: Record<string, string[]> = {
  cv: ['cv-comparison', 'background', 'inconsistencies'],
  court_document: ['orders', 'pleadings', 'lawsuits'],
  state_licensing: ['licenses', 'board-actions'],
  deposition_transcript: ['depositions', 'testimony-inconsistencies'],
  article: ['publications'],
  report: ['overall-findings', 'misc'],
  presentation: ['videos'],
  pdf: ['misc', 'source-index'],
  research_other: ['misc', 'source-index'],
};

/**
 * Builds a searchable table-of-contents / report reference index
 * linking EWI report sections to evidence document references.
 */
@Injectable()
export class EwiReportReferenceService {
  constructor(private readonly intake: EwiDocumentIntakeService) {}

  buildIndex(input: {
    investigationId?: string;
    documents?: EwiEvidenceDocument[];
    generatedAt?: string;
  }): EwiReportReferenceIndex {
    const documents =
      input.documents ?? this.intake.listDocuments(input.investigationId);
    const bySection = new Map<string, EwiEvidenceReference[]>();

    for (const section of EWI_REPORT_SECTIONS) {
      bySection.set(section.id, []);
    }

    for (const document of documents) {
      const sectionIds = KIND_TO_SECTIONS[document.kind] ?? ['misc'];
      for (const ref of document.evidenceReferences) {
        for (const sectionId of sectionIds) {
          const list = bySection.get(sectionId) ?? [];
          list.push(ref);
          bySection.set(sectionId, list);
        }
      }
    }

    const entries: EwiReportReferenceEntry[] = EWI_REPORT_SECTIONS.map(
      (section) => ({
        sectionId: section.id,
        sectionTitle: section.title,
        sectionNumber: section.number,
        evidenceReferences: bySection.get(section.id) ?? [],
      }),
    );

    const batesIndex: Record<string, EwiEvidenceReference[]> = {};
    const pageIndex: Record<string, EwiEvidenceReference[]> = {};

    for (const document of documents) {
      for (const ref of document.evidenceReferences) {
        if (ref.batesNumber) {
          const list = batesIndex[ref.batesNumber] ?? [];
          list.push(ref);
          batesIndex[ref.batesNumber] = list;
        }
        if (ref.pageNumber != null) {
          const key = `${ref.documentId}:${ref.pageNumber}`;
          const list = pageIndex[key] ?? [];
          list.push(ref);
          pageIndex[key] = list;
        }
      }
    }

    return {
      investigationId: input.investigationId,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      entries,
      batesIndex,
      pageIndex,
    };
  }

  /**
   * Search evidence refs by Bates number (exact match on detected values only).
   */
  findByBates(
    batesNumber: string,
    investigationId?: string,
  ): EwiEvidenceReference[] {
    const index = this.buildIndex({ investigationId });
    return index.batesIndex[batesNumber] ?? [];
  }

  /**
   * Search evidence refs by document + page (page must have been observed).
   */
  findByPage(
    documentId: string,
    pageNumber: number,
    investigationId?: string,
  ): EwiEvidenceReference[] {
    const index = this.buildIndex({ investigationId });
    return index.pageIndex[`${documentId}:${pageNumber}`] ?? [];
  }
}
