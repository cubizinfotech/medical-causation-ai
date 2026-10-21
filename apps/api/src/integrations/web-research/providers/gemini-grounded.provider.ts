import { createGeminiClient } from '@ai/utils/gemini-client.util';
import { classifyGeminiError } from '@ai/utils/gemini-errors.util';
import { extractSocialLeads } from '../social-leads';
import {
  SearchProviderError,
  type SearchHit,
  type SearchProvider,
  type SearchRequest,
  type WebSearchKind,
} from '../web-research.types';

const REDIRECT_HOST = 'vertexaisearch.cloud.google.com';

const CLOSER =
  'Use Google Search. For each page, give its URL and one fact the page itself supports about this exact person. Do not list pages that do not mention the person. Do not treat a website heading, menu or navigation label as a finding. Do not list other people who share a similar name.';

const THOROUGH =
  /\b(grant|NIH|IME|independent medical|education|degree|criminal|arrest|court|testimony|license|forensic|university|certif)/i;

/**
 * Google Search through Gemini grounding. Uses the existing GEMINI_API_KEY.
 * Hits are the pages Google grounded. The model's short answer is kept on
 * those hits as a research lead and is never itself a finding.
 */
export class GeminiGroundedSearchProvider implements SearchProvider {
  readonly id = 'gemini_grounding';
  readonly name = 'Google Search via Gemini grounding';
  readonly kinds: readonly WebSearchKind[] = ['web', 'news', 'scholar'];
  readonly concurrency = 3;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    readonly budget = 32,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(
    request: SearchRequest,
    timeoutMs: number,
  ): Promise<SearchHit[]> {
    if (!this.isConfigured()) {
      throw new SearchProviderError(
        'Gemini grounding is not configured (no API key).',
        'auth',
      );
    }
    const ai = createGeminiClient(this.apiKey);
    const prompt =
      request.prompt ??
      `Search the web for: ${request.query}. Report the pages that mention this exact person.`;
    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await ai.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${prompt}\n\n${CLOSER}`,
              },
            ],
          },
        ],
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0,
          maxOutputTokens: THOROUGH.test(prompt) ? 2048 : 1024,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
    } catch (error) {
      const info = classifyGeminiError(error);
      const kind =
        info.kind === 'quota'
          ? 'quota'
          : info.kind === 'rate_limit'
            ? 'rate_limited'
            : info.kind === 'auth' || info.kind === 'permission'
              ? 'auth'
              : info.kind === 'timeout'
                ? 'timeout'
                : info.kind === 'network'
                  ? 'network'
                  : info.kind === 'invalid_request' || info.kind === 'not_found'
                    ? 'unsupported'
                    : 'http';
      throw new SearchProviderError(
        `Gemini grounded search failed (${info.kind}): ${info.detail}`,
        kind,
        info.status,
      );
    }

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const chunks = metadata?.groundingChunks ?? [];
    const snippets = new Map<number, string[]>();
    for (const support of metadata?.groundingSupports ?? []) {
      const text = support.segment?.text?.trim();
      if (!text) continue;
      for (const index of support.groundingChunkIndices ?? []) {
        const list = snippets.get(index) ?? [];
        list.push(text);
        snippets.set(index, list);
      }
    }

    const answer = (response.text ?? '').trim();
    const hits: SearchHit[] = [];
    const seen = new Set<string>();
    for (const [index, chunk] of chunks.entries()) {
      const uri = chunk.web?.uri;
      if (!uri) continue;
      const url = await this.resolve(uri);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const lead = snippets.get(index)?.join(' ').slice(0, 600);
      hits.push({
        url,
        title: chunk.web?.title ?? url,
        snippet: lead,
        providerId: this.id,
        query: request.query,
        kind: request.kind,
        ...(lead ? { lead } : {}),
      });
    }
    for (const social of extractSocialLeads(answer)) {
      if (seen.has(social.url)) continue;
      seen.add(social.url);
      hits.push({
        url: social.url,
        title: social.title,
        snippet: social.context,
        providerId: this.id,
        query: request.query,
        kind: request.kind,
        lead: social.context,
      });
    }
    if (hits[0] && answer) hits[0].answer = answer;
    return hits;
  }

  /** Grounding links are redirects; the page the user can cite is the target. */
  private async resolve(uri: string): Promise<string | null> {
    let current: URL;
    try {
      current = new URL(uri);
    } catch {
      return null;
    }
    for (let hop = 0; hop < 3 && current.hostname === REDIRECT_HOST; hop++) {
      try {
        const response = await this.fetchImpl(current, {
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
        });
        const location = response.headers.get('location');
        if (!location) return null;
        current = new URL(location, current);
      } catch {
        return null;
      }
    }
    return current.hostname === REDIRECT_HOST ? null : current.toString();
  }
}
