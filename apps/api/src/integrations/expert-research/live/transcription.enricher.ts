import type {
  ExpertEvidenceItem,
  ExpertResearchSourceResult,
} from '../expert-research.types';
import { AssemblyAiClient } from './assemblyai.client';
import {
  canonicalMediaUrl,
  isYouTubeUrl,
  looksLikeDirectMediaUrl,
  probeDirectMedia,
} from './direct-media';

export const YOUTUBE_CANNOT_TRANSCRIBE =
  'This YouTube video cannot be transcribed automatically; open the link to watch it.';

export interface TranscriptionSettings {
  enabled: boolean;
  apiKey?: string;
  maxFiles: number;
  maxMinutes: number;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/**
 * Adds AssemblyAI transcripts to evidence that already has a direct public
 * media URL. Does not search for videos. Does not submit YouTube URLs.
 */
export class MediaTranscriptionEnricher {
  constructor(
    private readonly settings: TranscriptionSettings,
    private readonly client: AssemblyAiClient | null,
  ) {}

  async enrich(
    results: ExpertResearchSourceResult[],
  ): Promise<ExpertResearchSourceResult[]> {
    if (!this.settings.enabled || !this.client) return results;
    const seen = new Set<string>();
    let used = 0;
    const maxFiles = Math.max(0, Math.floor(this.settings.maxFiles));
    const next: ExpertResearchSourceResult[] = [];
    for (const result of results) {
      const items: ExpertEvidenceItem[] = [];
      for (const item of result.items) {
        if (used >= maxFiles) {
          items.push(item);
          continue;
        }
        const url = item.url?.trim();
        if (!url) {
          items.push(item);
          continue;
        }
        if (isYouTubeUrl(url)) {
          items.push(withYoutubeReason(item));
          continue;
        }
        if (!isTranscriptCandidate(item, url)) {
          items.push(item);
          continue;
        }
        const key = canonicalMediaUrl(url);
        if (seen.has(key)) {
          items.push(item);
          continue;
        }
        seen.add(key);
        const probe = await probeDirectMedia(url, {
          timeoutMs: Math.min(this.settings.timeoutMs, 8000),
          fetchImpl: this.settings.fetchImpl,
          maxMinutes: this.settings.maxMinutes,
        });
        if (!probe.acceptable) {
          items.push(
            withTranscriptMeta(item, {
              transcriptAvailable: false,
              transcriptUnavailableReason:
                probe.skipReason ??
                'This file was not sent for transcription.',
            }),
          );
          continue;
        }
        try {
          const transcript = await this.client.transcribeUrl(url);
          used += 1;
          items.push(
            withTranscriptMeta(item, {
              transcript: transcript.text || null,
              transcriptAvailable: Boolean(transcript.text),
              transcriptUnavailableReason: transcript.text
                ? null
                : 'Transcription finished but returned no text.',
              importantStatements: excerptsWithTimestamps(transcript.words),
              audioDurationSeconds: transcript.audioDuration,
              transcriptId: transcript.id,
            }),
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Transcription failed.';
          items.push(
            withTranscriptMeta(item, {
              transcriptAvailable: false,
              transcriptUnavailableReason: `Transcription was not completed (${message}). The video or audio link is still listed.`,
            }),
          );
        }
      }
      next.push({ ...result, items });
    }
    return next;
  }
}

function isTranscriptCandidate(item: ExpertEvidenceItem, url: string): boolean {
  if (looksLikeDirectMediaUrl(url)) return true;
  const kind = String(item.raw?.presenceKind ?? item.category ?? '');
  return (
    kind === 'video' ||
    kind === 'presentation' ||
    kind === 'youtube' ||
    item.category === 'video' ||
    item.category === 'presentation'
  );
}

function withYoutubeReason(item: ExpertEvidenceItem): ExpertEvidenceItem {
  if (item.raw?.transcriptAvailable === false) return item;
  return withTranscriptMeta(item, {
    transcriptAvailable: false,
    transcriptUnavailableReason: YOUTUBE_CANNOT_TRANSCRIBE,
  });
}

function withTranscriptMeta(
  item: ExpertEvidenceItem,
  extra: Record<string, unknown>,
): ExpertEvidenceItem {
  return {
    ...item,
    raw: {
      ...(item.raw ?? {}),
      ...extra,
    },
  };
}

function excerptsWithTimestamps(
  words: Array<{ text: string; start: number; end: number }>,
): string[] {
  if (words.length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length && chunks.length < 6) {
    const end = Math.min(start + 24, words.length);
    const slice = words.slice(start, end);
    const stamp = formatMs(slice[0]?.start ?? 0);
    chunks.push(`[${stamp}] ${slice.map((word) => word.text).join(' ')}`);
    start = end;
  }
  return chunks;
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function createTranscriptionEnricher(
  settings: TranscriptionSettings,
): MediaTranscriptionEnricher | null {
  if (!settings.enabled || !settings.apiKey) return null;
  return new MediaTranscriptionEnricher(
    settings,
    new AssemblyAiClient({
      apiKey: settings.apiKey,
      timeoutMs: settings.timeoutMs,
      fetchImpl: settings.fetchImpl,
    }),
  );
}
