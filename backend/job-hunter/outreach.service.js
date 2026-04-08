import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { findAll, insertOne } from '../middleware/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..', '..');
const DEFAULT_OUTREACH_DIR = path.join(ROOT_DIR, 'PICT-HACKATHON', 'backend');
const COL_OUTREACH = 'job_hunter_outreach';

function nowIso() {
  return new Date().toISOString();
}

function runCommand(command, args, cwd, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill();
      resolve({ ok: false, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: `${stderr}\n${err.message}` });
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr, exitCode: code });
    });
  });
}

export async function sendOutreach(userId, payload = {}) {
  const id = randomUUID();
  const target = String(payload.target || payload.recruiter || payload.company || 'Unknown target').trim();
  const channel = String(payload.channel || 'email').trim();
  const tone = String(payload.tone || 'formal').trim();
  const message = String(payload.message || payload.profileText || '').trim();
  const dryRun = payload.dryRun !== false;

  const row = {
    id,
    userId,
    target,
    channel,
    tone,
    message,
    status: 'sent',
    source: 'PICT-HACKATHON',
    response: null,
    logs: [`Outreach created (${dryRun ? 'dry-run' : 'live'})`],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (!dryRun) {
    const pythonCmd = process.env.JOB_HUNTER_PYTHON_BIN || 'python';
    const outreachDir = process.env.JOB_HUNTER_OUTREACH_PATH || DEFAULT_OUTREACH_DIR;
    const script = `
import json, sys
sys.path.insert(0, '.')
from main import generate
payload = {"profile_text": ${JSON.stringify(message || target)}, "channel": ${JSON.stringify(channel)}, "tone": ${JSON.stringify(tone)}, "language": "English"}
print(json.dumps(generate(payload)))
`.trim();
    const result = await runCommand(pythonCmd, ['-c', script], outreachDir);
    if (result.ok) {
      try {
        row.response = JSON.parse(result.stdout.trim());
      } catch {
        row.response = { raw: result.stdout.trim() };
      }
    } else {
      row.status = 'failed';
      row.logs.push(`stderr:\n${result.stderr.slice(0, 3000)}`);
    }
  } else {
    row.response = {
      response: message || `Hi ${target}, I would love to connect regarding opportunities.`,
      reply_score: 72,
      note: 'Dry run response. Set dryRun=false to invoke local PICT-HACKATHON backend.',
    };
  }

  row.updatedAt = nowIso();
  await insertOne(COL_OUTREACH, row);
  return row;
}

export async function listOutreach(userId) {
  const rows = await findAll(COL_OUTREACH, (x) => x.userId === userId);
  return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}
