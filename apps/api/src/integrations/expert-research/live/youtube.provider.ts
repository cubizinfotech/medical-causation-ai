import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import { parseCityState } from './location';
import { parsePersonName, type PersonName } from './person-name';
import { searchProfessionPhrase, specialtyOverlaps } from './specialty-match';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import {
  YoutubeClient,
  youtubeWatchUrl,
  type YoutubeSearchHit,
  type YoutubeVideoDetails,
} from './youtube.client';

export const YOUTUBE_TRANSCRIPT_UNAVAILABLE =
  'This YouTube video cannot be transcribed automatically; open the link to watch it.';

export function youtubeTranscriptReason(
  captionAvailable: boolean | null | undefined,
): string {
  if (captionAvailable === true) {
    return `${YOUTUBE_TRANSCRIPT_UNAVAILABLE} YouTube lists captions, but they can be downloaded only by the video owner.`;
  }
  if (captionAvailable === false) {
    return `${YOUTUBE_TRANSCRIPT_UNAVAILABLE} YouTube did not list captions on this video.`;
  }
  return YOUTUBE_TRANSCRIPT_UNAVAILABLE;
}

/**
 * Public YouTube video discovery. One search.list plus one videos.list when
 * a key is set. A video is kept only when the expert’s first and last name
 * both appear in the title, description, or channel. Specialty or place is
 * required before the hit is attributed. Transcripts are never fetched.
 */
export class YoutubeResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly client: YoutubeClient | null,
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    if (!this.client) {
      return {
        items: [],
        status: 'unavailable',
        message:
          'Not searched. YouTube Data API is not configured (no API key). Set YOUTUBE_API_KEY to search public videos. Without a key, public web search may still find YouTube pages.',
      };
    }
    const name = parsePersonName(query.expertName);
    if (!name) {
      return {
        items: [],
        status: 'unavailable',
        message:
          'Not searched. YouTube needs the expert’s first and last name.',
      };
    }

    const searchQuery = buildYoutubeQuery(query, name);
    const hits = await this.client.searchVideos(searchQuery);
    if (hits.length === 0) {
      return {
        items: [],
        message: `YouTube search for ${query.expertName} returned no public videos. This is not proof that the expert has no videos.`,
      };
    }

    const details = await this.videoDetails(hits);
    const considered = details.length > 0 ? details : hits;
    const named: YoutubeVideoDetails[] = [];
    const attributed: YoutubeVideoDetails[] = [];
    const candidates: YoutubeVideoDetails[] = [];
    for (const video of considered) {
      if (!videoNamesMatch(video, name)) continue;
      named.push(video);
      if (supportingEvidence(video, query)) attributed.push(video);
      else candidates.push(video);
    }

    if (named.length === 0) {
      return {
        items: [],
        message: `YouTube returned ${hits.length} video(s) for the search, but none named ${name.first} ${name.last} in the title, description, or channel. Nothing was attributed.`,
      };
    }

    const items = [...attributed, ...candidates].map((video) =>
      this.videoItem(
        video,
        query,
        retrievedAt,
        supportingEvidence(video, query),
      ),
    );
    return {
      items,
      message: [
        `${named.length} public YouTube video(s) name ${name.first} ${name.last} in the title, description, or channel.`,
        attributed.length > 0
          ? `${attributed.length} also mention the expert’s specialty or place and are listed as possible matches, not confirmed identity.`
          : null,
        candidates.length > 0
          ? `${candidates.length} name-only hit(s) are listed as unverified and are not treated as the expert: ${candidates
              .slice(0, 4)
              .map((video) => `“${video.title}”`)
              .join('; ')}${candidates.length > 4 ? '; …' : ''}.`
          : null,
        YOUTUBE_TRANSCRIPT_UNAVAILABLE,
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  private async videoDetails(
    hits: YoutubeSearchHit[],
  ): Promise<YoutubeVideoDetails[]> {
    if (!this.client) return [];
    try {
      const details = await this.client.videosById(
        hits.map((hit) => hit.videoId),
      );
      if (details.length === 0) return hits;
      const byId = new Map(details.map((video) => [video.videoId, video]));
      return hits.map((hit) => byId.get(hit.videoId) ?? hit);
    } catch {
      return hits;
    }
  }

  private videoItem(
    video: YoutubeVideoDetails,
    query: ExpertResearchQuery,
    retrievedAt: string,
    corroborated: string | null,
  ): ExpertEvidenceItem {
    const url = youtubeWatchUrl(video.videoId);
    const published = video.publishedAt
      ? video.publishedAt.slice(0, 10)
      : null;
    const transcriptReason = youtubeTranscriptReason(video.captionAvailable);
    return this.item({
      category: 'video',
      title: video.title,
      summary: [
        `Public YouTube video “${video.title}”.`,
        video.channelTitle ? `Channel: ${video.channelTitle}.` : null,
        published ? `Published ${published}.` : null,
        video.description
          ? `Description excerpt: ${video.description.slice(0, 280)}.`
          : null,
        corroborated
          ? `The listing also mentions the expert’s ${corroborated}. A same-name video is not proof it is this person.`
          : 'Only the name matched. This is not treated as a video by this expert.',
        transcriptReason,
      ]
        .filter(Boolean)
        .join(' '),
      url,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        presenceKind: 'youtube',
        platform: 'youtube',
        videoId: video.videoId,
        channelTitle: video.channelTitle,
        channelId: video.channelId || null,
        publishedAt: video.publishedAt,
        durationIso: video.durationIso ?? null,
        captionAvailable: video.captionAvailable ?? null,
        description: video.description || null,
        transcript: null,
        transcriptAvailable: false,
        transcriptUnavailableReason: transcriptReason,
        identity: {
          name: query.expertName,
          verifiedBy: corroborated ? 'source_match' : undefined,
          ambiguous: !corroborated,
        },
      },
    });
  }
}

/** Quoted name plus specialty, kept short for the 100-unit search quota. */
export function buildYoutubeQuery(
  query: ExpertResearchQuery,
  name: PersonName,
): string {
  const specialty = searchProfessionPhrase(query.specialty);
  const person = `"${capitalize(name.first)} ${capitalize(name.last)}"`;
  return specialty ? `${person} ${specialty}` : person;
}

/**
 * First and last name must both appear as words in title, description, or
 * channel. Initials count for the first name ("J. Smith").
 */
export function videoNamesMatch(
  video: Pick<YoutubeSearchHit, 'title' | 'description' | 'channelTitle'>,
  name: PersonName,
): boolean {
  const haystack = `${video.title} ${video.description} ${video.channelTitle}`;
  if (!wordIn(haystack, name.last)) return false;
  if (wordIn(haystack, name.first)) return true;
  if (name.first.length > 0 && initialIn(haystack, name.first[0], name.last)) {
    return true;
  }
  return false;
}

/** Specialty or city in the listing, used only after the name already matched. */
export function supportingEvidence(
  video: Pick<YoutubeSearchHit, 'title' | 'description' | 'channelTitle'>,
  query: ExpertResearchQuery,
): string | null {
  const haystack = `${video.title} ${video.description} ${video.channelTitle}`;
  if (query.specialty.trim() && specialtyOverlaps(query.specialty, haystack)) {
    return `specialty (${query.specialty.trim()})`;
  }
  const city = parseCityState(query.city || '').city;
  if (city && city.length > 2 && wordIn(haystack, city)) {
    return `place (${city})`;
  }
  return null;
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function wordIn(haystack: string, word: string): boolean {
  if (!word) return false;
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  return pattern.test(haystack);
}

function initialIn(haystack: string, initial: string, last: string): boolean {
  const pattern = new RegExp(
    `\\b${escapeRegExp(initial)}\\.?\\s+${escapeRegExp(last)}\\b`,
    'i',
  );
  return pattern.test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
