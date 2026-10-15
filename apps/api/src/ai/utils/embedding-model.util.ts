/**
 * "openai/text-embedding-3-small" and "text-embedding-3-small" name the same
 * model: providers return the bare name while the setting may carry a
 * prefix. Vectors are comparable only when provider and model both match.
 */
export function sameEmbeddingModel(a: string, b: string): boolean {
  const bare = (model: string) =>
    model.trim().toLowerCase().split('/').pop() ?? '';
  return bare(a) !== '' && bare(a) === bare(b);
}
