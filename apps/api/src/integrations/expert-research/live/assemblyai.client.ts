import { fetchJson, LiveHttpError } from './live-http';

const ASSEMBLY_API = 'https://api.assemblyai.com/v2/transcript';

export interface AssemblyTranscriptWord {
  text: string;
  start: number;
  end: number;
}

export interface AssemblyTranscript {
  id: string;
  text: string;
  words: AssemblyTranscriptWord[];
  audioDuration: number | null;
}

interface TranscriptResponse {
  id?: string;
  status?: string;
  text?: string | null;
  words?: Array<{ text?: string; start?: number; end?: number }>;
  audio_duration?: number | null;
  error?: string;
}

export interface AssemblyAiClientOptions {
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  pollMs?: number;
  maxWaitMs?: number;
}

/**
 * AssemblyAI speech-to-text. Submit a public audio_url only. YouTube watch
 * URLs are rejected by the API and are never sent.
 */
export class AssemblyAiClient {
  constructor(private readonly options: AssemblyAiClientOptions) {}

  async transcribeUrl(audioUrl: string): Promise<AssemblyTranscript> {
    const created = await fetchJson<TranscriptResponse>(ASSEMBLY_API, {
      method: 'POST',
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
      headers: {
        Authorization: this.options.apiKey,
      },
      body: {
        audio_url: audioUrl,
        punctuate: true,
        format_text: true,
      },
    });
    const id = created.id?.trim();
    if (!id) {
      throw new LiveHttpError(
        created.error || 'AssemblyAI did not return a transcript id.',
        'http',
      );
    }
    return this.poll(id);
  }

  private async poll(id: string): Promise<AssemblyTranscript> {
    const started = Date.now();
    const pollMs = this.options.pollMs ?? 3000;
    const maxWaitMs = this.options.maxWaitMs ?? 180_000;
    while (Date.now() - started < maxWaitMs) {
      const body = await fetchJson<TranscriptResponse>(
        `${ASSEMBLY_API}/${id}`,
        {
          timeoutMs: this.options.timeoutMs,
          fetchImpl: this.options.fetchImpl,
          headers: { Authorization: this.options.apiKey },
        },
      );
      const status = (body.status ?? '').toLowerCase();
      if (status === 'completed') {
        return {
          id,
          text: (body.text ?? '').trim(),
          words: (body.words ?? []).flatMap((word) => {
            const text = word.text?.trim();
            return text
              ? [
                  {
                    text,
                    start: word.start ?? 0,
                    end: word.end ?? 0,
                  },
                ]
              : [];
          }),
          audioDuration: body.audio_duration ?? null,
        };
      }
      if (status === 'error') {
        throw new LiveHttpError(
          body.error || 'AssemblyAI could not transcribe this file.',
          'http',
        );
      }
      await sleep(pollMs);
    }
    throw new LiveHttpError(
      'AssemblyAI did not finish transcribing before the wait limit.',
      'timeout',
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
