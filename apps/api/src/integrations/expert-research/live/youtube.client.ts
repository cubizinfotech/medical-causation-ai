import { fetchJson, LiveHttpError } from './live-http';

export const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
export const DEFAULT_YOUTUBE_MAX_RESULTS = 25;
export const YOUTUBE_MAX_RESULTS_CAP = 50;

export interface YoutubeSearchHit {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string | null;
}

export interface YoutubeVideoDetails extends YoutubeSearchHit {
  durationIso?: string | null;
  /** Whether YouTube itself lists captions. Download remains owner-only. */
  captionAvailable?: boolean | null;
}

interface YoutubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: YoutubeSnippet;
  }>;
  error?: YoutubeErrorBody;
}

interface YoutubeVideosResponse {
  items?: Array<{
    id?: string;
    snippet?: YoutubeSnippet;
    contentDetails?: { duration?: string; caption?: string };
  }>;
  error?: YoutubeErrorBody;
}

interface YoutubeSnippet {
  title?: string;
  description?: string;
  channelTitle?: string;
  channelId?: string;
  publishedAt?: string;
}

interface YoutubeErrorBody {
  code?: number;
  message?: string;
  errors?: Array<{ reason?: string; message?: string }>;
}

export interface YoutubeClientOptions {
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  maxResults?: number;
  baseUrl?: string;
}

/**
 * YouTube Data API v3 search and video metadata. API key is a query
 * parameter. Captions are not requested: captions.download is owner-only.
 */
export class YoutubeClient {
  constructor(private readonly options: YoutubeClientOptions) {}

  get maxResults(): number {
    const requested = this.options.maxResults ?? DEFAULT_YOUTUBE_MAX_RESULTS;
    if (!Number.isFinite(requested)) return DEFAULT_YOUTUBE_MAX_RESULTS;
    return Math.min(
      YOUTUBE_MAX_RESULTS_CAP,
      Math.max(1, Math.floor(requested)),
    );
  }

  async searchVideos(query: string): Promise<YoutubeSearchHit[]> {
    const body = await this.get<YoutubeSearchResponse>('search', {
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults: String(this.maxResults),
      safeSearch: 'moderate',
      relevanceLanguage: 'en',
    });
    return (body.items ?? []).flatMap((item) => {
      const videoId = item.id?.videoId?.trim();
      return videoId ? [hitFromSnippet(videoId, item.snippet)] : [];
    });
  }

  async videosById(ids: string[]): Promise<YoutubeVideoDetails[]> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) return [];
    const body = await this.get<YoutubeVideosResponse>('videos', {
      part: 'snippet,contentDetails',
      id: unique.join(','),
    });
    return (body.items ?? []).flatMap((item) => {
      const videoId = item.id?.trim();
      if (!videoId) return [];
      const caption = item.contentDetails?.caption?.trim().toLowerCase();
      const details: YoutubeVideoDetails = {
        ...hitFromSnippet(videoId, item.snippet),
        durationIso: item.contentDetails?.duration ?? null,
        captionAvailable:
          caption === 'true' ? true : caption === 'false' ? false : null,
      };
      return [details];
    });
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(
      `${(this.options.baseUrl ?? YOUTUBE_API).replace(/\/$/, '')}/${path}`,
    );
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('key', this.options.apiKey);
    try {
      return await fetchJson<T>(url, {
        timeoutMs: this.options.timeoutMs,
        fetchImpl: this.options.fetchImpl,
      });
    } catch (error) {
      if (error instanceof LiveHttpError && error.status === 403) {
        throw new LiveHttpError(
          'YouTube rejected the request (HTTP 403). This is often the daily search quota or an API key that is not enabled for YouTube Data API v3. Nothing was inferred.',
          'rate_limited',
          403,
        );
      }
      throw error;
    }
  }
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function hitFromSnippet(
  videoId: string,
  snippet: YoutubeSnippet | undefined,
): YoutubeSearchHit {
  return {
    videoId,
    title: snippet?.title?.trim() || `YouTube video ${videoId}`,
    description: snippet?.description?.trim() ?? '',
    channelTitle: snippet?.channelTitle?.trim() ?? '',
    channelId: snippet?.channelId?.trim() ?? '',
    publishedAt: snippet?.publishedAt?.trim() || null,
  };
}
