/**
 * Social profile URLs and X/Twitter handles named in a search answer or
 * snippet. These are addresses only: the profiles are not opened.
 */

export interface SocialLead {
  url: string;
  title: string;
  context: string;
  platform: string;
}

const SOCIAL_URL =
  /https?:\/\/(?:www\.)?(linkedin\.com|facebook\.com|fb\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|threads\.net|bsky\.app)\/[^\s<>"')\]]+/gi;

const SKIP_HANDLES = new Set([
  'twitter',
  'linkedin',
  'youtube',
  'instagram',
  'facebook',
  'tiktok',
  'http',
  'https',
  'gmail',
  'hotmail',
  'here',
  'clinic',
]);

const PLATFORM: Record<string, string> = {
  'linkedin.com': 'linkedin',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'instagram.com': 'instagram',
  'x.com': 'x',
  'twitter.com': 'x',
  'tiktok.com': 'tiktok',
  'threads.net': 'other',
  'bsky.app': 'bluesky',
};

function trimUrl(raw: string): string {
  return raw.replace(/[.,;:!?]+$/, '');
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function sentenceAround(text: string, index: number): string {
  const start = text.lastIndexOf('.', Math.max(0, index - 1));
  const end = text.indexOf('.', index);
  const slice = text.slice(start + 1, end === -1 ? text.length : end + 1);
  return slice.replace(/\s+/g, ' ').trim();
}

function withNameContext(text: string, local: string): string {
  const intro = text.slice(0, 280).replace(/\s+/g, ' ').trim();
  if (!intro || local.includes(intro.slice(0, 40))) return local.slice(0, 500);
  return `${intro} ${local}`.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function titleFor(url: string, platform: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const last = path.split('/').filter(Boolean).pop() ?? '';
    const handle = last.replace(/^@/, '');
    if (!handle) return `${platform} profile`;
    if (platform === 'x' || platform === 'twitter') return `@${handle}`;
    if (/\/company\//i.test(path)) return `${handle} (institutional LinkedIn)`;
    return handle;
  } catch {
    return `${platform} profile`;
  }
}

/**
 * Public social profile addresses written in a grounded search answer.
 * Handles become x.com URLs only when the text is talking about X/Twitter.
 */
export function extractSocialLeads(text: string): SocialLead[] {
  if (!text.trim()) return [];
  const found: SocialLead[] = [];
  const seen = new Set<string>();
  const take = (
    url: string,
    platform: string,
    index: number,
    title?: string,
  ) => {
    const key = url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const local = sentenceAround(text, index) || text.slice(0, 240);
    found.push({
      url,
      title: title ?? titleFor(url, platform),
      context: withNameContext(text, local),
      platform,
    });
  };

  for (const match of text.matchAll(SOCIAL_URL)) {
    const url = trimUrl(match[0]);
    const host = hostOf(url);
    const platform = PLATFORM[host];
    if (!platform) continue;
    take(url, platform, match.index ?? 0);
  }

  const talksTwitter = /\b(twitter|\bx\b|x\.com)\b/i.test(text);
  if (talksTwitter) {
    for (const match of text.matchAll(
      /(?<![A-Za-z0-9._])@([A-Za-z0-9_]{3,30})\b/g,
    )) {
      const handle = match[1];
      if (SKIP_HANDLES.has(handle.toLowerCase())) continue;
      take(`https://x.com/${handle}`, 'x', match.index ?? 0, `@${handle}`);
    }
  }

  return found;
}
