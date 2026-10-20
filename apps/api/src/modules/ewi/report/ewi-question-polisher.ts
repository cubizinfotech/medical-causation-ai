import type { QuestionDraft } from './ewi-report-questions';

export type QuestionLlm = (input: {
  system: string;
  user: string;
  maxTokens: number;
}) => Promise<string>;

const BATCH = 12;
const MAX_POLISHED = 72;

const SYSTEM = `You tighten cross-examination questions for an attorney. You are not a source of facts.

Rules:
- Rewrite each draft as one short, leading question in the style: "You ..., correct?" or "<Source> reported ...: "<quote>" You are aware of that, correct?".
- Use ONLY the facts given in the draft and basis. Keep every quoted passage word for word.
- Do not add names, dates, numbers, places, cases, findings or any other fact.
- Keep the meaning of the label: an "allegation" is something a third party reported (say so, never state it as proven); an "unresolved" item must stay conditional ("If this refers to you ...", "Can you confirm ...").
- Keep the source (outlet or website) and the date when the draft names one.
- Respond with one JSON object: {"items":[{"id":string,"question":string}]} and nothing else.`;

/**
 * Rewrites question wording with a model, then keeps a rewrite only when it
 * still holds every anchor fact and adds no new number. Anything else falls
 * back to the original draft, so the wording can improve but never drift.
 */
export async function polishQuestions(
  drafts: QuestionDraft[],
  llm: QuestionLlm,
  onWarn?: (message: string) => void,
): Promise<QuestionDraft[]> {
  const result = drafts.map((draft) => ({ ...draft }));
  const targets = result.slice(0, MAX_POLISHED);
  for (let start = 0; start < targets.length; start += BATCH) {
    const batch = targets.slice(start, start + BATCH);
    try {
      const raw = await llm({
        system: SYSTEM,
        user: JSON.stringify({
          items: batch.map((draft, index) => ({
            id: String(start + index),
            label: draft.label,
            draft: draft.question,
            basis: draft.evidenceBasis,
          })),
        }),
        maxTokens: 3000,
      });
      const rewrites = parseRewrites(raw);
      for (const [index, draft] of batch.entries()) {
        const text = rewrites.get(String(start + index));
        if (text && acceptRewrite(text, draft)) draft.question = text.trim();
      }
    } catch (error) {
      onWarn?.(
        `Question wording kept as drafted for one batch: ${error instanceof Error ? error.message : 'model request failed'}`,
      );
    }
  }
  return result;
}

export function parseRewrites(raw: string): Map<string, string> {
  const rewrites = new Map<string, string>();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return rewrites;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      items?: Array<{ id?: unknown; question?: unknown }>;
    };
    for (const entry of parsed.items ?? []) {
      if (typeof entry.id === 'string' && typeof entry.question === 'string') {
        rewrites.set(entry.id, entry.question);
      }
    }
  } catch {
    // Unparseable output: every draft keeps its wording.
  }
  return rewrites;
}

export function acceptRewrite(text: string, draft: QuestionDraft): boolean {
  const rewrite = text.trim();
  if (rewrite.length < 30 || rewrite.length > 700 || !rewrite.endsWith('?')) {
    return false;
  }
  const flat = squash(rewrite);
  if (!draft.anchors.every((anchor) => flat.includes(squash(anchor)))) {
    return false;
  }
  const allowed = new Set(
    numbersIn(`${draft.question} ${draft.evidenceBasis}`),
  );
  return numbersIn(rewrite).every((number) => allowed.has(number));
}

function squash(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”"’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function numbersIn(value: string): string[] {
  return value.match(/\d[\d,.]*/g)?.map((n) => n.replace(/[.,]+$/, '')) ?? [];
}
