import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_ROOT = path.join(__dirname, '..', 'rag', 'corpus');

function walkMdFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkMdFiles(p, acc);
    else if (name.endsWith('.md') || name.endsWith('.txt')) acc.push(p);
  }
  return acc;
}

function scoreDoc(query, text) {
  const q = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let hit = 0;
  for (const w of words) if (q.has(w)) hit++;
  return hit;
}

export function readCorpusFiles(query, k = 5) {
  const files = walkMdFiles(CORPUS_ROOT);
  const scored = [];
  for (const file of files) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      const s = scoreDoc(query, text);
      if (s > 0) scored.push({ path: file, text: text.slice(0, 6000), score: s });
    } catch {
      // skip
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(({ path: p, text }) => ({ source: p, text }));
}
