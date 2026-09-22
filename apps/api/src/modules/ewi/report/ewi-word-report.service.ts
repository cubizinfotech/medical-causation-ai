import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { ReportArtifact } from '@platform/report/report.types';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../research/cross-exam-question.generator';

export interface EwiReportInput {
  expertName: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  discrepancies: ExpertDiscrepancy[];
  questions: CrossExamQuestion[];
  generatedAt: string;
}

export interface EwiReportOutput extends ReportArtifact {
  buffer: Buffer;
  format: 'docx';
}

@Injectable()
export class EwiWordReportService {
  async build(input: EwiReportInput): Promise<EwiReportOutput> {
    const children: Paragraph[] = [
      new Paragraph({
        text: 'Expert Witness Investigation Report',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${input.expertName} — ${input.specialty}`,
            bold: true,
            size: 28,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: `Generated: ${input.generatedAt}`,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: 'For attorney work-product / legal research purposes only. Not a certification of accuracy of third-party sources.',
        spacing: { before: 200, after: 400 },
      }),
      new Paragraph({
        text: '1. Executive Summary',
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        text: `This report summarizes automated research for ${input.expertName} (${input.specialty}). Collected ${input.evidence.length} evidence items, identified ${input.discrepancies.length} discrepancy finding(s), and generated ${input.questions.length} cross-examination questions.`,
      }),
      new Paragraph({
        text: '2. Collected Evidence',
        heading: HeadingLevel.HEADING_1,
      }),
    ];

    for (const item of input.evidence) {
      children.push(
        new Paragraph({
          text: `${item.category.toUpperCase()}: ${item.title}`,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: item.summary }),
      );
      if (item.url) {
        children.push(new Paragraph({ text: `Source: ${item.url}` }));
      }
      if (item.simulated) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '[Simulated / mock source — replace with live adapters when configured]',
                italics: true,
              }),
            ],
          }),
        );
      }
    }

    children.push(
      new Paragraph({
        text: '3. Discrepancies',
        heading: HeadingLevel.HEADING_1,
      }),
    );
    for (const d of input.discrepancies) {
      children.push(
        new Paragraph({
          text: `[${d.severity.toUpperCase()}] ${d.title}`,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: d.description }),
      );
    }

    children.push(
      new Paragraph({
        text: '4. Cross-Examination Questions',
        heading: HeadingLevel.HEADING_1,
      }),
    );

    let currentCategory = '';
    for (const q of input.questions) {
      if (q.category !== currentCategory) {
        currentCategory = q.category;
        children.push(
          new Paragraph({
            text: currentCategory,
            heading: HeadingLevel.HEADING_2,
          }),
        );
      }
      children.push(
        new Paragraph({
          text: `${q.number}. ${q.question}`,
          spacing: { before: 120 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Evidence basis: ${q.evidenceBasis}`,
              italics: true,
              size: 20,
            }),
          ],
        }),
      );
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = Buffer.from(await Packer.toBuffer(doc));
    const safeName = input.expertName
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase();

    return {
      fileName: `ewi-${safeName}-report.docx`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      format: 'docx',
      buffer,
    };
  }
}
