/**
 * URL → plain text using fetch + cheerio (Node-friendly alternative to BeautifulSoup).
 */
import * as cheerio from 'cheerio';

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 20_000;

export async function scrapeUrlToText(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http(s) URLs are allowed');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const res = await fetch(url.href, {
    signal: controller.signal,
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; IntelligentLearningStudyBot/1.0; educational)',
    },
  });
  clearTimeout(timer);
  if (!res.ok) throw new Error(`Page returned ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error('Page too large (max ~2MB)');

  const html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  const $ = cheerio.load(html);
  $('script, noscript, style, svg, iframe, picture').remove();
  const main = $('main, article, [role="main"]').first();
  const root = main.length ? main : $('body');
  let text = root.text();
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length < 80) {
    text = $('body').text().replace(/\s+/g, ' ').trim();
  }
  return text.slice(0, 150_000);
}
