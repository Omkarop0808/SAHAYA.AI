import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { findAll, findOne, insertOne, updateOne } from '../middleware/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..', '..');
const DEFAULT_AGENT_DIR = path.join(ROOT_DIR, 'Auto_Jobs_Applier_AI_Agent');

const COL_APPLICATIONS = 'job_hunter_applications';
const RUN_STREAMS = new Map();

function nowIso() {
  return new Date().toISOString();
}

function getRunBus(runId) {
  if (!RUN_STREAMS.has(runId)) {
    RUN_STREAMS.set(runId, { listeners: new Set(), latest: null, completed: false });
  }
  return RUN_STREAMS.get(runId);
}

function emitRunEvent(runId, event) {
  const bus = getRunBus(runId);
  bus.latest = event;
  for (const listener of bus.listeners) listener(event);
}

function finishRunStream(runId) {
  const bus = getRunBus(runId);
  bus.completed = true;
  emitRunEvent(runId, { type: 'complete', runId, ts: nowIso() });
}

function subscribeRun(runId, listener) {
  const bus = getRunBus(runId);
  bus.listeners.add(listener);
  if (bus.latest) listener(bus.latest);
  return () => {
    bus.listeners.delete(listener);
  };
}

async function appendLogAndPersist(runId, line) {
  const current = await findOne(COL_APPLICATIONS, (x) => x.id === runId);
  if (!current) return;
  const logs = [...(current.logs || []), line];
  await updateOne(COL_APPLICATIONS, (x) => x.id === runId, { logs, updatedAt: nowIso() });
}

function runCommandStreaming(command, args, cwd, runId, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: process.platform === 'win32' });
    let done = false;

    const timer = setTimeout(async () => {
      if (done) return;
      done = true;
      child.kill();
      await appendLogAndPersist(runId, `Timed out after ${timeoutMs}ms`);
      emitRunEvent(runId, { type: 'log', runId, line: `Timed out after ${timeoutMs}ms`, ts: nowIso() });
      resolve({ ok: false, exitCode: -1 });
    }, timeoutMs);

    child.stdout?.on('data', async (chunk) => {
      const line = String(chunk).trimEnd();
      if (!line) return;
      await appendLogAndPersist(runId, line);
      emitRunEvent(runId, { type: 'log', runId, line, ts: nowIso() });
    });

    child.stderr?.on('data', async (chunk) => {
      const line = String(chunk).trimEnd();
      if (!line) return;
      await appendLogAndPersist(runId, `ERR: ${line}`);
      emitRunEvent(runId, { type: 'log', runId, line: `ERR: ${line}`, ts: nowIso() });
    });

    child.on('error', async (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      await appendLogAndPersist(runId, `Process error: ${err.message}`);
      emitRunEvent(runId, { type: 'log', runId, line: `Process error: ${err.message}`, ts: nowIso() });
      resolve({ ok: false, exitCode: -1 });
    });

    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, exitCode: code });
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

  app.status = 'running';
  app.logs = [
    ...app.logs,
    `Target role: ${role}`,
    `Target location: ${location}`,
    `Skills: ${skills.join(', ') || 'n/a'}`,
    dryRun ? 'Dry run started.' : 'Executing Auto_Jobs_Applier_AI_Agent/main.py --collect',
  ];
  await insertOne(COL_APPLICATIONS, app);

  emitRunEvent(runId, { type: 'status', runId, status: 'running', ts: nowIso() });
  for (const line of app.logs) emitRunEvent(runId, { type: 'log', runId, line, ts: nowIso() });

  if (!dryRun) {
    const pythonCmd = process.env.JOB_HUNTER_PYTHON_BIN || 'python';
    const agentDir = process.env.JOB_HUNTER_AUTO_APPLIER_PATH || DEFAULT_AGENT_DIR;
    runCommandStreaming(pythonCmd, ['main.py', '--collect'], agentDir, runId)
      .then(async (result) => {
        const status = result.ok ? 'submitted' : 'failed';
        await updateOne(COL_APPLICATIONS, (x) => x.id === runId, { status, updatedAt: nowIso() });
        emitRunEvent(runId, { type: 'status', runId, status, ts: nowIso() });
        finishRunStream(runId);
      })
      .catch(async (err) => {
        await appendLogAndPersist(runId, `Unexpected run error: ${err.message}`);
        await updateOne(COL_APPLICATIONS, (x) => x.id === runId, { status: 'failed', updatedAt: nowIso() });
        emitRunEvent(runId, { type: 'status', runId, status: 'failed', ts: nowIso() });
        finishRunStream(runId);
      });
  } else {
    await appendLogAndPersist(runId, 'Dry run complete. Set dryRun=false to execute local Python pipeline.');
    await updateOne(COL_APPLICATIONS, (x) => x.id === runId, { status: 'submitted', updatedAt: nowIso() });
    emitRunEvent(runId, { type: 'log', runId, line: 'Dry run complete. Set dryRun=false to execute local Python pipeline.', ts: nowIso() });
    emitRunEvent(runId, { type: 'status', runId, status: 'submitted', ts: nowIso() });
    finishRunStream(runId);
  }

  return app;
}

export async function listApplications(userId) {
  const rows = await findAll(COL_APPLICATIONS, (x) => x.userId === userId);
  return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export async function getApplication(userId, applicationId) {
  return findOne(COL_APPLICATIONS, (x) => x.userId === userId && x.id === applicationId);
}

export function streamRunEvents(runId, onEvent) {
  return subscribeRun(runId, onEvent);
}
