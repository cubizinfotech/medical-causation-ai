import type { EwiDocumentKind } from './ewi-evidence-reference.types';

/**
 * Infer document kind from filename / hints. Does not invent content.
 */
export function inferEwiDocumentKind(input: {
  filename: string;
  mimeHint?: string;
  categoryHint?: string;
}): EwiDocumentKind {
  const name = input.filename.toLowerCase();
  const hint =
    `${input.categoryHint ?? ''} ${input.mimeHint ?? ''}`.toLowerCase();
  const hay = `${name} ${hint}`;

  if (/\bcv\b|curriculum|resume/.test(hay)) return 'cv';
  if (/deposit|transcript/.test(hay)) return 'deposition_transcript';
  if (/license|licensure|board.?action|medical.?board/.test(hay)) {
    return 'state_licensing';
  }
  if (/order|motion|pleading|complaint|judgment|court/.test(hay)) {
    return 'court_document';
  }
  if (/presentation|powerpoint|\.pptx?\b|slides/.test(hay))
    return 'presentation';
  if (/article|pubmed|journal/.test(hay)) return 'article';
  if (/report/.test(hay)) return 'report';
  if (name.endsWith('.pdf')) return 'pdf';
  return 'research_other';
}
