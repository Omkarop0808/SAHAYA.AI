import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAG_SCRIPT = path.join(__dirname, '..', 'rag', 'rag_cli.py');

/**
 * Local RAG via Python (llmware when available; else corpus keyword retrieval).
 * @param {string} query
 * @param {{ mode?: string, k?: number }} opts mode: 'topics' | 'interview' | 'jd'
 */
export async function ragRetrieve(query, opts = {}) {
  const mode = opts.mode || 'topics';
  const k = opts.k ?? 5;
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

  try {
    const { stdout } = await execFileAsync(python, [RAG_SCRIPT, 'retrieve', query, mode, String(k)], {
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    const parsed = JSON.parse(stdout.trim());
    if (parsed?.chunks && Array.isArray(parsed.chunks)) return parsed.chunks;
  } catch (e) {
    console.warn('[ragLocal] Python RAG failed, using JS fallback:', e?.message || e);
  }

  return jsFallbackRetrieve(query, k);
}

async function jsFallbackRetrieve(query, k) {
  const { readCorpusFiles } = await import('./ragFallback.js');
  return readCorpusFiles(query, k);
}
