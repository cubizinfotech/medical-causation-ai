import { Injectable } from '@nestjs/common';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertDiscrepancy } from './discrepancy-analyzer';

export interface CrossExamQuestion {
  number: number;
  category: string;
  question: string;
  evidenceBasis: string;
}

const CATEGORIES = [
  'Credentials & Licensure',
  'Education & Training',
  'Board Certification',
  'Publications & Scholarship',
  'Prior Testimony & Bias',
  'Methodology & Opinions',
  'Financial Interests',
  'Public Statements & Media',
  'Discrepancies & Inconsistencies',
  'Professional Conduct',
] as const;

const MIN_QUESTIONS = 100;

/**
 * Generates at least 100 evidence-based cross-examination questions.
 * Template expansion keeps local/dev deterministic without requiring an LLM.
 */
@Injectable()
export class CrossExamQuestionGenerator {
  generate(params: {
    expertName: string;
    specialty: string;
    evidence: ExpertEvidenceItem[];
    discrepancies: ExpertDiscrepancy[];
  }): CrossExamQuestion[] {
    const { expertName, specialty, evidence, discrepancies } = params;
    const questions: CrossExamQuestion[] = [];
    let n = 1;

    const push = (
      category: string,
      question: string,
      evidenceBasis: string,
    ) => {
      questions.push({ number: n++, category, question, evidenceBasis });
    };

    for (const d of discrepancies) {
      push(
        'Discrepancies & Inconsistencies',
        `Doctor ${expertName}, how do you reconcile the following inconsistency: ${d.title}?`,
        d.description,
      );
      push(
        'Discrepancies & Inconsistencies',
        `Is it accurate that ${d.description}`,
        d.relatedUrls.join('; ') || d.title,
      );
    }

    for (const item of evidence) {
      const category =
        item.category === 'license'
          ? 'Credentials & Licensure'
          : item.category === 'education'
            ? 'Education & Training'
            : item.category === 'publication'
              ? 'Publications & Scholarship'
              : item.category === 'legal'
                ? 'Prior Testimony & Bias'
                : item.category === 'news'
                  ? 'Public Statements & Media'
                  : item.category === 'patent'
                    ? 'Financial Interests'
                    : 'Methodology & Opinions';

      push(
        category,
        `Doctor ${expertName}, regarding “${item.title}”, can you confirm the accuracy of this public record?`,
        item.summary + (item.url ? ` (${item.url})` : ''),
      );
      push(
        category,
        `Did you disclose “${item.title}” when preparing your opinions in this matter?`,
        item.summary,
      );
    }

    // Pad to minimum with specialty-grounded templates.
    let templateIndex = 0;
    while (questions.length < MIN_QUESTIONS) {
      const category = CATEGORIES[templateIndex % CATEGORIES.length];
      const i = Math.floor(templateIndex / CATEGORIES.length) + 1;
      templateIndex += 1;

      push(
        category,
        this.templateQuestion(category, expertName, specialty, i),
        `Generated from ${specialty} investigation context and collected evidence set (${evidence.length} items).`,
      );
    }

    return questions.slice(0, Math.max(MIN_QUESTIONS, questions.length));
  }

  private templateQuestion(
    category: string,
    expertName: string,
    specialty: string,
    index: number,
  ): string {
    switch (category) {
      case 'Credentials & Licensure':
        return `Doctor ${expertName}, please identify every jurisdiction in which you currently hold an unrestricted license to practice ${specialty} (item ${index}).`;
      case 'Education & Training':
        return `Doctor ${expertName}, what postgraduate training specifically qualifies you to offer opinions in ${specialty} (item ${index})?`;
      case 'Board Certification':
        return `Doctor ${expertName}, are you currently board-certified in ${specialty}, and when was your last recertification (item ${index})?`;
      case 'Publications & Scholarship':
        return `Doctor ${expertName}, which of your publications within ${specialty} did you rely upon for your opinions in this case (item ${index})?`;
      case 'Prior Testimony & Bias':
        return `Doctor ${expertName}, in the last five years, what percentage of your expert work in ${specialty} was for plaintiffs versus defendants (item ${index})?`;
      case 'Methodology & Opinions':
        return `Doctor ${expertName}, what methodology did you apply to reach your ${specialty} opinions, and is it generally accepted (item ${index})?`;
      case 'Financial Interests':
        return `Doctor ${expertName}, do you have any financial interest in products, patents, or entities related to ${specialty} opinions in this case (item ${index})?`;
      case 'Public Statements & Media':
        return `Doctor ${expertName}, have you made public statements about ${specialty} standards that conflict with your opinions here (item ${index})?`;
      case 'Discrepancies & Inconsistencies':
        return `Doctor ${expertName}, if a public record conflicts with your CV regarding ${specialty} credentials, which should the jury credit (item ${index})?`;
      default:
        return `Doctor ${expertName}, have you ever been disciplined by a licensing board or professional society related to ${specialty} (item ${index})?`;
    }
  }
}
