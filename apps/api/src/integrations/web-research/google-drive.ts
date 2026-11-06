/**
 * Public Google Drive file links. Resolves sharing URLs to the export
 * download endpoint. Never bypasses login, CAPTCHA, or permission gates.
 */

const FILE_ID = /^[a-zA-Z0-9_-]{10,}$/;

const DRIVE_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'drive.usercontent.google.com',
]);

/** True when the URL is a Google Drive / Docs file sharing or download link. */
export function isGoogleDriveFileUrl(raw: string): boolean {
  return googleDriveFileId(raw) != null;
}

/** Extract a Drive file id from common public sharing URL shapes. */
export function googleDriveFileId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!DRIVE_HOSTS.has(host) && !host.endsWith('.googleusercontent.com')) {
    return null;
  }

  const pathId = url.pathname.match(
    /\/(?:file|document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/i,
  );
  if (pathId && FILE_ID.test(pathId[1])) return pathId[1];

  const openId = url.searchParams.get('id');
  if (openId && FILE_ID.test(openId)) return openId;

  // /uc?export=download&id=… or /uc?id=…
  if (/\/uc(\/|$)/i.test(url.pathname) || url.pathname === '/uc') {
    const id = url.searchParams.get('id');
    if (id && FILE_ID.test(id)) return id;
  }

  return null;
}

/**
 * Public export URL for a Drive file. Callers must still validate that the
 * response is a real document (PDF magic), not an HTML login or interstitial.
 */
export function googleDriveExportUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

/** Resolve a sharing URL to the export download URL, or null if not Drive. */
export function resolveGoogleDriveDownloadUrl(raw: string): string | null {
  const id = googleDriveFileId(raw);
  if (!id) return null;
  // Already an export URL with the same id — keep query as-is when export is set.
  try {
    const url = new URL(raw);
    if (
      /\/uc(\/|$)/i.test(url.pathname) &&
      url.searchParams.get('export') === 'download' &&
      url.searchParams.get('id') === id
    ) {
      return url.toString();
    }
  } catch {
    /* fall through */
  }
  return googleDriveExportUrl(id);
}

/** True when bytes look like a PDF (%PDF). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

/** True when a Drive response body is an HTML gate, not a document. */
export function isGoogleDriveHtmlGate(body: string, contentType: string): boolean {
  if (/application\/pdf/i.test(contentType)) return false;
  const head = body.slice(0, 8000);
  if (!/html|text\/html|<(!doctype|html|head|body)/i.test(`${contentType} ${head}`)) {
    return false;
  }
  return (
    /accounts\.google\.com/i.test(head) ||
    /sign[\s-]?in/i.test(head) ||
    /you need access/i.test(head) ||
    /request access/i.test(head) ||
    /sorry, the file you have requested does not exist/i.test(head) ||
    /not found/i.test(head) ||
    /virus scan warning/i.test(head) ||
    /download_warning/i.test(head) ||
    /uc-download-link/i.test(head) ||
    /drive\.google\.com\/file\/d\//i.test(head) ||
    /<title>[^<]*google drive[^<]*<\/title>/i.test(head) ||
    /This file is in the owner's trash/i.test(head)
  );
}

export type GoogleDriveFetchOutcome =
  | { kind: 'pdf'; bytes: Buffer; finalUrl: string; httpStatus: number; contentType: string }
  | {
      kind: 'restricted' | 'failed';
      note: string;
      finalUrl: string;
      httpStatus?: number;
      contentType?: string;
    };

/**
 * Fetch a publicly shared Drive file as PDF bytes. Does not confirm virus-scan
 * interstitials or sign in. Large-file confirmation pages are reported as
 * restricted rather than bypassed.
 */
export async function fetchGoogleDrivePdf(input: {
  url: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxBytes?: number;
  userAgent: string;
  lookup?: (host: string) => Promise<Array<{ address: string }>>;
  refuse?: (url: URL) => Promise<{ status: 'failed' | 'restricted'; note: string } | null>;
}): Promise<GoogleDriveFetchOutcome> {
  const download = resolveGoogleDriveDownloadUrl(input.url);
  if (!download) {
    return {
      kind: 'failed',
      note: 'The Google Drive address could not be resolved to a file.',
      finalUrl: input.url,
    };
  }

  let current: URL;
  try {
    current = new URL(download);
  } catch {
    return {
      kind: 'failed',
      note: 'The Google Drive download address is not a valid URL.',
      finalUrl: download,
    };
  }

  const maxBytes = input.maxBytes ?? 8_000_000;
  for (let hop = 0; hop <= 5; hop++) {
    if (input.refuse) {
      const refusal = await input.refuse(current);
      if (refusal) {
        return {
          kind: refusal.status,
          note: refusal.note,
          finalUrl: current.toString(),
        };
      }
    }

    let response: Response;
    try {
      response = await input.fetchImpl(current, {
        redirect: 'manual',
        headers: {
          'User-Agent': input.userAgent,
          Accept: 'application/pdf,application/octet-stream,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(input.timeoutMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      return {
        kind: 'failed',
        note: timedOut
          ? 'The Google Drive file timed out.'
          : 'The Google Drive file could not be reached.',
        finalUrl: current.toString(),
      };
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      try {
        current = new URL(location, current);
      } catch {
        return {
          kind: 'failed',
          note: 'The Google Drive file redirected to an invalid address.',
          finalUrl: current.toString(),
        };
      }
      continue;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const finalUrl = current.toString();

    if (response.status === 401 || response.status === 403) {
      return {
        kind: 'restricted',
        note: `The Google Drive file requires sign-in or is not shared publicly (HTTP ${response.status}). It was not accessed.`,
        finalUrl,
        httpStatus: response.status,
        contentType,
      };
    }
    if (response.status === 404) {
      return {
        kind: 'failed',
        note: 'The Google Drive file was not found or has been deleted.',
        finalUrl,
        httpStatus: response.status,
        contentType,
      };
    }
    if (response.status >= 400) {
      return {
        kind: 'failed',
        note: `The Google Drive file returned HTTP ${response.status}.`,
        finalUrl,
        httpStatus: response.status,
        contentType,
      };
    }

    const bytes = await readLimitedBytes(response, maxBytes);
    if (looksLikePdf(bytes)) {
      return {
        kind: 'pdf',
        bytes,
        finalUrl,
        httpStatus: response.status,
        contentType: contentType || 'application/pdf',
      };
    }

    const asText = bytes.toString('utf8');
    if (isGoogleDriveHtmlGate(asText, contentType)) {
      const needsConfirm =
        /virus scan warning|download_warning|uc-download-link|confirm=t/i.test(
          asText,
        );
      return {
        kind: 'restricted',
        note: needsConfirm
          ? 'Google Drive asked for a download confirmation (virus-scan warning). Automated download was not confirmed, so the file was not retrieved.'
          : 'The Google Drive link is not publicly readable as a document (login, permission, preview page, or unavailable file). It was not accessed beyond the public share.',
        finalUrl,
        httpStatus: response.status,
        contentType,
      };
    }

    return {
      kind: 'failed',
      note: 'The Google Drive response was not a PDF or supported document.',
      finalUrl,
      httpStatus: response.status,
      contentType,
    };
  }

  return {
    kind: 'failed',
    note: 'The Google Drive file redirected too many times.',
    finalUrl: current.toString(),
  };
}

async function readLimitedBytes(
  response: Response,
  limit: number,
): Promise<Buffer> {
  if (!response.body) {
    return Buffer.from(await response.arrayBuffer()).subarray(0, limit);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
