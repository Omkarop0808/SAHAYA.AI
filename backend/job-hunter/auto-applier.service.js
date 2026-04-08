import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { findAll, insertOne } from '../middleware/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..', '..');
const DEFAULT_AGENT_DIR = path.join(ROOT_DIR, 'Auto_Jobs_Applier_AI_Agent');

const COL_APPLICATIONS = 'job_hunter_applications';

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

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
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

function parseSkills(skills) {
  if (Array.isArray(skills)) return skills.filter(Boolean).map(String);
  if (typeof skills === 'string') return skills.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function triggerAutoApply(userId, payload = {}) {
  const runId = randomUUID();
  const role = String(payload.role || payload.roleType || 'Software Engineer').trim();
  const location = String(payload.location || 'Remote').trim();
  const experience = String(payload.experience || payload.experienceLevel || 'entry').trim();
  const skills = parseSkills(payload.skills);
  const dryRun = payload.dryRun !== false;

  const app = {
    id: runId,
    userId,
    role,
    location,
    experience,
    skills,
    status: 'queued',
    source: 'Auto_Jobs_Applier_AI_Agent',
    logs: [`Run created (${dryRun ? 'dry-run' : 'live'})`],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (!dryRun) {
    const pythonCmd = process.env.JOB_HUNTER_PYTHON_BIN || 'python';
    const agentDir = process.env.JOB_HUNTER_AUTO_APPLIER_PATH || DEFAULT_AGENT_DIR;
    const run = await runCommand(pythonCmd, ['main.py', '--collect'], agentDir);
    app.status = run.ok ? 'submitted' : 'failed';
    app.logs = [
      ...app.logs,
      'Executed Auto_Jobs_Applier_AI_Agent/main.py --collect',
      ...(run.stdout ? [`stdout:\n${run.stdout.slice(0, 6000)}`] : []),
      ...(run.stderr ? [`stderr:\n${run.stderr.slice(0, 3000)}`] : []),
    ];
  } else {
    app.status = 'submitted';
    app.logs = [
      ...app.logs,
      `Target role: ${role}`,
      `Target location: ${location}`,
      `Skills: ${skills.join(', ') || 'n/a'}`,
      'Dry run complete. Set dryRun=false to execute local Python pipeline.',
    ];
  }

  app.updatedAt = nowIso();
  await insertOne(COL_APPLICATIONS, app);
  return app;
}

export async function listApplications(userId) {
  const rows = await findAll(COL_APPLICATIONS, (x) => x.userId === userId);
  return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}
