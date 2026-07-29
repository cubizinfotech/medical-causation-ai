import type { PrivateReference } from "@/features/medical-analysis/types";

const CLASSIFICATION_BADGES: Record<
  NonNullable<PrivateReference["classification"]>,
  string
> = {
  supporting: "Supporting",
  opposing: "Opposing",
  neutral: "Neutral",
  unknown: "Referenced",
};

export function getPrivateSourceSummary(ref: PrivateReference): string {
  if (ref.summary?.trim()) {
    return ref.summary;
  }

  const title = ref.documentName;
  const location = ref.pageNumber ? `page ${ref.pageNumber}` : "indexed content";
  return `Passage from "${title}" (${location}) cited in this causation analysis.`;
}

export function getPrivateSourceClassificationLabel(
  classification?: PrivateReference["classification"],
): string | null {
  if (!classification) {
    return null;
  }
  return CLASSIFICATION_BADGES[classification];
}
