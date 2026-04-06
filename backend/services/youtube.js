/**
 * YouTube helpers: video id, oEmbed metadata, optional Data API v3 search.
 */

export function extractYoutubeVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id && id.length >= 6 ? id : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m) return m[1];
      const sMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (sMatch) return sMatch[1];
    }
  } catch {
    const m = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    if (m) return m[1];
  }
  return null;
}

export async function fetchYoutubeOembed(videoUrl) {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  const res = await fetch(oembedUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudyApp/1.0)' },
  });
  if (!res.ok) throw new Error(`YouTube oEmbed failed (${res.status})`);
  return res.json();
}

/**
 * @param {string} query
 * @returns {Promise<Array<{ videoId: string, title: string, channelTitle?: string }>>}
 */
export async function youtubeSearchTopVideos(query, maxResults = 3) {
  const key = process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_DATA_API_KEY;
  if (!key) return [];
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('key', key);
  const res = await fetch(url.href);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`YouTube API: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const items = data.items || [];
  return items
    .map((it) => ({
      videoId: it.id?.videoId,
      title: it.snippet?.title || '',
      channelTitle: it.snippet?.channelTitle,
    }))
    .filter((x) => x.videoId);
}

export async function buildYoutubeStudyContext(youtubeUrl) {
  const id = extractYoutubeVideoId(youtubeUrl);
  if (!id) throw new Error('Could not parse YouTube URL');
  const canonical = `https://www.youtube.com/watch?v=${id}`;
  let title = '';
  let author = '';
  try {
    const meta = await fetchYoutubeOembed(canonical);
    title = meta.title || '';
    author = meta.author_name || '';
  } catch {
    title = `YouTube video ${id}`;
  }
  return { text: `[YouTube]\nTitle: ${title}\nChannel: ${author}\nURL: ${canonical}\n(Transcript not available — summarize and teach from title/channel context.)`, title, author, videoId: id, canonicalUrl: canonical };
}
