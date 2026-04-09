/**
 * One-time: push all backend/data/*.json arrays into Supabase app_data_rows.
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (run from backend/)
 *
 *   cd backend && npm run db:migrate-to-supabase
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { computeRowId } from '../services/rowId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const url = process.env.SUPABASE_URL?.trim();
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_KEY?.trim();

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const TABLE = 'app_data_rows';

async function upsertChunk(rows) {
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'collection,row_id' });
  if (error) throw new Error(error.message);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('No data directory — nothing to migrate.');
    return;
  }
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const collection = file.replace(/\.json$/, '');
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn('Skip invalid JSON:', file);
      continue;
    }
    if (!Array.isArray(data)) {
      console.warn('Skip non-array:', file);
      continue;
    }
    const payloads = data.map((d) => ({
      collection,
      row_id: computeRowId(collection, d),
      payload: d,
      updated_at: new Date().toISOString(),
    }));
    const chunk = 200;
    for (let i = 0; i < payloads.length; i += chunk) {
      await upsertChunk(payloads.slice(i, i + chunk));
    }
    console.log(`Migrated ${collection}: ${payloads.length} rows`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
