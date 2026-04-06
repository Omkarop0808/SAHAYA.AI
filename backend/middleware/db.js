import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabase, isSupabaseEnabled } from '../services/supabaseClient.js';
import { computeRowId } from '../services/rowId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const TABLE = 'app_data_rows';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function getFilePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readFileDB(name) {
  const filePath = getFilePath(name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([]));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function writeFileDB(name, data) {
  fs.writeFileSync(getFilePath(name), JSON.stringify(data, null, 2));
}

async function readSupabase(collection) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(TABLE).select('payload').eq('collection', collection);
  if (error) throw new Error(`Supabase read ${collection}: ${error.message}`);
  return (data || []).map((r) => r.payload);
}

async function writeSupabase(collection, rows) {
  const supabase = getSupabase();
  const payloads = rows.map((d) => ({
    collection,
    row_id: computeRowId(collection, d),
    payload: d,
    updated_at: new Date().toISOString(),
  }));

  const { data: existing, error: selErr } = await supabase.from(TABLE).select('row_id').eq('collection', collection);
  if (selErr) throw new Error(`Supabase list ${collection}: ${selErr.message}`);

  const nextIds = new Set(payloads.map((r) => r.row_id));
  const stale = (existing || []).map((e) => e.row_id).filter((id) => !nextIds.has(id));

  if (stale.length) {
    const { error: delErr } = await supabase.from(TABLE).delete().eq('collection', collection).in('row_id', stale);
    if (delErr) throw new Error(`Supabase delete stale ${collection}: ${delErr.message}`);
  }

  const chunk = 250;
  for (let i = 0; i < payloads.length; i += chunk) {
    const { error: upErr } = await supabase
      .from(TABLE)
      .upsert(payloads.slice(i, i + chunk), { onConflict: 'collection,row_id' });
    if (upErr) throw new Error(`Supabase upsert ${collection}: ${upErr.message}`);
  }
}

async function upsertOneSupabase(collection, doc) {
  const supabase = getSupabase();
  const row = {
    collection,
    row_id: computeRowId(collection, doc),
    payload: doc,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'collection,row_id' });
  if (error) throw new Error(`Supabase upsertOne ${collection}: ${error.message}`);
}

/**
 * Read all documents in a collection (same shape as legacy JSON array).
 * @param {string} name
 * @returns {Promise<any[]>}
 */
export async function readDB(name) {
  if (isSupabaseEnabled()) return readSupabase(name);
  return readFileDB(name);
}

/**
 * Replace entire collection with `data` array.
 * @param {string} name
 * @param {any[]} data
 */
export async function writeDB(name, data) {
  if (isSupabaseEnabled()) return writeSupabase(name, data);
  writeFileDB(name, data);
}

export async function findOne(collection, predicate) {
  const data = await readDB(collection);
  return data.find(predicate) || null;
}

export async function findAll(collection, predicate) {
  const data = await readDB(collection);
  return predicate ? data.filter(predicate) : data;
}

export async function insertOne(collection, doc) {
  if (isSupabaseEnabled()) {
    await upsertOneSupabase(collection, doc);
    return doc;
  }
  const data = readFileDB(collection);
  data.push(doc);
  writeFileDB(collection, data);
  return doc;
}

export async function updateOne(collection, predicate, updates) {
  if (isSupabaseEnabled()) {
    const data = await readSupabase(collection);
    const idx = data.findIndex(predicate);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...updates };
    await writeSupabase(collection, data);
    return data[idx];
  }
  const data = readFileDB(collection);
  const idx = data.findIndex(predicate);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates };
  writeFileDB(collection, data);
  return data[idx];
}

export async function upsertOne(collection, predicate, doc) {
  if (isSupabaseEnabled()) {
    const data = await readSupabase(collection);
    const idx = data.findIndex(predicate);
    if (idx === -1) data.push(doc);
    else data[idx] = { ...data[idx], ...doc };
    await writeSupabase(collection, data);
    return idx === -1 ? doc : data[data.findIndex(predicate)];
  }
  const data = readFileDB(collection);
  const idx = data.findIndex(predicate);
  if (idx === -1) {
    data.push(doc);
  } else {
    data[idx] = { ...data[idx], ...doc };
  }
  writeFileDB(collection, data);
  return idx === -1 ? doc : data[data.findIndex(predicate)];
}

export async function deleteOne(collection, predicate) {
  if (isSupabaseEnabled()) {
    const data = await readSupabase(collection);
    const idx = data.findIndex(predicate);
    if (idx === -1) return false;
    data.splice(idx, 1);
    await writeSupabase(collection, data);
    return true;
  }
  const data = readFileDB(collection);
  const idx = data.findIndex(predicate);
  if (idx === -1) return false;
  data.splice(idx, 1);
  writeFileDB(collection, data);
  return true;
}
