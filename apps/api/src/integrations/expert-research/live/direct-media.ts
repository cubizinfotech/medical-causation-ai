/**
 * Direct public audio/video files that AssemblyAI can fetch itself.
 * YouTube watch pages are never treated as media URLs.
 */

const YOUTUBE_HOST = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i;
const MEDIA_EXT = /\.(mp3|m4a|wav|ogg|flac|mp4|m4v|webm)(?:$|[?#])/i;
const MEDIA_TYPE = /^(audio|video)\//i;

/** ~128 kbps audio, used only when duration is not stated. */
const BYTES_PER_SECOND = 16_000;
const UNKNOWN_SIZE_CAP_BYTES = 80 * 1024 * 1024;

export function isYouTubeUrl(url: string): boolean {
  try {
    return YOUTUBE_HOST.test(new URL(url).hostname);
  } catch {
    return /youtube\.com|youtu\.be/i.test(url);
  }
}

export function looksLikeDirectMediaUrl(url: string): boolean {
  if (!url || isYouTubeUrl(url)) return false;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return false;
    return MEDIA_EXT.test(parsed.pathname);
  } catch {
    return false;
  }
}

export interface MediaProbe {
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  acceptable: boolean;
  skipReason: string | null;
}

export async function probeDirectMedia(
  url: string,
  options: {
    timeoutMs: number;
    fetchImpl?: typeof fetch;
    maxMinutes: number;
  },
): Promise<MediaProbe> {
  const skip = (reason: string): MediaProbe => ({
    url,
    contentType: null,
    sizeBytes: null,
    durationSeconds: null,
    acceptable: false,
    skipReason: reason,
  });
  if (isYouTubeUrl(url)) {
    return skip(
      'This YouTube video cannot be transcribed automatically; open the link to watch it.',
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch {
    if (looksLikeDirectMediaUrl(url)) {
      return {
        url,
        contentType: null,
        sizeBytes: null,
        durationSeconds: null,
        acceptable: true,
        skipReason: null,
      };
    }
    return skip('The media address could not be checked, so it was not sent for transcription.');
  }
  const contentType = response.headers.get('content-type');
  const sizeHeader = response.headers.get('content-length');
  const sizeBytes = sizeHeader ? Number(sizeHeader) : null;
  const durationHeader = response.headers.get('x-content-duration');
  const headerSeconds = durationHeader ? Number(durationHeader) : null;
  const byType = Boolean(contentType && MEDIA_TYPE.test(contentType.split(';')[0] ?? ''));
  const byExt = looksLikeDirectMediaUrl(url);
  if (!byType && !byExt) {
    return skip('This address is not a public audio or video file, so it was not transcribed.');
  }
  const estimatedSeconds =
    Number.isFinite(headerSeconds) && (headerSeconds as number) > 0
      ? (headerSeconds as number)
      : sizeBytes && sizeBytes > 0
        ? sizeBytes / BYTES_PER_SECOND
        : null;
  if (
    estimatedSeconds != null &&
    estimatedSeconds / 60 > options.maxMinutes
  ) {
    return skip(
      `This file is longer than the ${options.maxMinutes}-minute transcription cap, so it was not sent.`,
    );
  }
  if (
    estimatedSeconds == null &&
    sizeBytes != null &&
    sizeBytes > UNKNOWN_SIZE_CAP_BYTES
  ) {
    return skip(
      'This file is large and its length is unknown, so it was not sent for transcription.',
    );
  }
  return {
    url,
    contentType: contentType?.split(';')[0] ?? null,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
    durationSeconds: estimatedSeconds,
    acceptable: true,
    skipReason: null,
  };
}

export function canonicalMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.trim();
  }
}
