import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../research/cross-exam-question.generator';

export const MIN_GROUNDED_QUESTIONS = 100;

/**
 * Leading questions that cite collected findings only.
 * One or more findings is enough to reach the minimum by varying the
 * examination angle. No findings means no questions are invented.
 */
export function buildGroundedCrossExamQuestions(input: {
  expertName: string;
  evidence: ExpertEvidenceItem[];
  discrepancies?: ExpertDiscrepancy[];
}): CrossExamQuestion[] {
  const questions: CrossExamQuestion[] = [];
  const name = input.expertName.trim() || 'Doctor';

  for (const discrepancy of input.discrepancies ?? []) {
    push(questions, {
      category: 'Findings and Discrepancies',
      question: `Doctor ${name}, the collected materials conflict: "${discrepancy.title}". You cannot reconcile that conflict from anything else in this file, can you?`,
      evidenceBasis: discrepancy.description,
    });
  }

  if (input.evidence.length === 0) {
    return questions;
  }

  const angles = input.evidence.flatMap((item) =>
    leadingAngles(name, item).map((question) => ({
      category: sectionLabel(item),
      question,
      evidenceBasis: basis(item),
    })),
  );

  let index = 0;
  while (questions.length < MIN_GROUNDED_QUESTIONS) {
    const angle = angles[index % angles.length];
    const pass = Math.floor(index / angles.length) + 1;
    push(questions, {
      category: angle.category,
      question:
        pass === 1
          ? angle.question
          : `Returning to the same collected record, examination point ${pass}: ${angle.question}`,
      evidenceBasis: angle.evidenceBasis,
    });
    index += 1;
  }

  return questions;
}

function leadingAngles(name: string, item: ExpertEvidenceItem): string[] {
  const title = item.title;
  const source = item.sourceId;
  const status = uncertainty(item);
  const link = item.url
    ? `The only collected link is ${item.url}`
    : 'No source link was collected for that item';
  const statusLine = `The collected status of "${title}" is: ${status}.`;
  return [
    `Doctor ${name}, the investigation file contains a record titled "${title}", correct? ${statusLine}`,
    `The record titled "${title}" from ${source} is ${status}, isn't it?`,
    `${link}. That is the citation in this file for "${title}", correct? ${statusLine}`,
    `You cannot point to any fact in this file about "${title}" beyond what ${source} collected, can you? ${statusLine}`,
    `Nothing in this investigation independently verifies "${title}" beyond that ${status} record, does it?`,
    `If "${title}" were withdrawn, you would have no other collected source in this file for that point, would you? ${statusLine}`,
    `You are asking the jury to accept a record that is ${status}, titled "${title}", correct?`,
    `Counsel has not been given any additional document in this file that changes the ${status} status of "${title}", have they?`,
  ];
}

function uncertainty(item: ExpertEvidenceItem): string {
  if (item.access === 'restricted') {
    return 'restricted, with the underlying content not stored';
  }
  if (item.informationStatus === 'conflicting') {
    return 'in conflict with another collected statement';
  }
  if (item.informationStatus === 'verified') {
    return 'marked verified by the collected source';
  }
  return 'unverified, and this investigation could not verify it';
}

function basis(item: ExpertEvidenceItem): string {
  const link = item.url ? ` ${item.url}` : '';
  const summary =
    item.access === 'restricted' || !item.summary
      ? 'Content was not stored.'
      : item.summary;
  return `${item.sourceId}: ${summary}${link}`;
}

function sectionLabel(item: ExpertEvidenceItem): string {
  return item.category || item.sourceId;
}

function push(
  questions: CrossExamQuestion[],
  item: Omit<CrossExamQuestion, 'number'>,
): void {
  questions.push({ number: questions.length + 1, ...item });
}
