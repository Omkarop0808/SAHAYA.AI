import express from 'express';
import { randomUUID } from 'crypto';
import vm from 'vm';
import * as cheerio from 'cheerio';
import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pdfParse from 'pdf-parse';
import { authMiddleware } from '../middleware/auth.js';
import { callGroqChat, callGroqChatJSON, callGeminiStructuredJSON } from '../services/careerAi.js';
import { ragRetrieve } from '../services/ragLocal.js';
import { tavilySearch } from '../services/tavily.js';
import { findAll, findOne, insertOne, updateOne } from '../middleware/db.js';
import { awardXp, getOrCreateGamification, incrementQuest, WORLDS } from '../services/gamificationCore.js';

const router = express.Router();

const COL_ATTEMPTS = 'career_problem_attempts';
const COL_ROOMS = 'career_rooms';
const COL_INTERVIEWS = 'career_interviews';
const COL_RESUME = 'career_resume_intel';
const COL_RESUME_PROFILE = 'career_resume_profiles';
const COL_JD = 'career_jd_scans';
const COL_APP_KIT = 'career_application_kits';
const COL_ROLE_INTEL_CACHE = 'career_role_intel_cache';
const COL_RECRUITER_SIM = 'career_recruiter_sim_sessions';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => cb(null, `resume-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname || '.pdf')}`),
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function nowIso() {
  return new Date().toISOString();
}

function seedProblems() {
  return [
    {
      id: 'two-sum',
      title: 'Two Sum',
      topic: 'Arrays & Hashing',
      difficulty: 'Easy',
      functionName: 'twoSum',
      prompt: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\nAssume exactly one solution, and you may not use the same element twice.',
      starterCode: `function twoSum(nums, target) {\n  // TODO\n}\n`,
      expected: { type: 'explain', note: 'Implement and explain your approach; AI review will evaluate complexity and edge cases.' },
      tests: [
        { input: [[2, 7, 11, 15], 9], output: [0, 1] },
        { input: [[3, 2, 4], 6], output: [1, 2] },
        { input: [[3, 3], 6], output: [0, 1] },
      ],
    },
    {
      id: 'valid-parentheses',
      title: 'Valid Parentheses',
      topic: 'Stacks',
      difficulty: 'Easy',
      functionName: 'isValid',
      prompt: 'Given a string s containing just the characters (){}[], determine if the input string is valid.',
      starterCode: `function isValid(s) {\n  // TODO\n}\n`,
      expected: { type: 'explain' },
      tests: [
        { input: ['()'], output: true },
        { input: ['()[]{}'], output: true },
        { input: ['(]'], output: false },
        { input: ['([)]'], output: false },
      ],
    },
    {
      id: 'binary-search',
      title: 'Binary Search',
      topic: 'Binary Search',
      difficulty: 'Easy',
      functionName: 'search',
      prompt: 'Given a sorted array of integers nums and a target, return the index if found, else -1.',
      starterCode: `function search(nums, target) {\n  // TODO\n}\n`,
      expected: { type: 'explain' },
      tests: [
        { input: [[-1, 0, 3, 5, 9, 12], 9], output: 4 },
        { input: [[-1, 0, 3, 5, 9, 12], 2], output: -1 },
      ],
    },
    {
      id: 'merge-intervals',
      title: 'Merge Intervals',
      topic: 'Intervals',
      difficulty: 'Medium',
      functionName: 'merge',
      prompt: 'Given an array of intervals, merge all overlapping intervals and return an array of non-overlapping intervals.',
      starterCode: `function merge(intervals) {\n  // TODO\n}\n`,
      expected: { type: 'explain' },
      tests: [
        { input: [[[1, 3], [2, 6], [8, 10], [15, 18]]], output: [[1, 6], [8, 10], [15, 18]] },
        { input: [[[1, 4], [4, 5]]], output: [[1, 5]] },
      ],
    },
  ];
}

function dayKey(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
}

function pickDailyProblemForUser(userId = '', d = new Date()) {
  const problems = seedProblems();
  if (!problems.length) return null;
  const key = `${dayKey(d)}:${String(userId || '')}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  const idx = Math.abs(hash) % problems.length;
  return problems[idx];
}

function rotateProblemsForDay(userId = '', d = new Date()) {
  const problems = seedProblems();
  if (!problems.length) return [];
  const daily = pickDailyProblemForUser(userId, d);
  const rest = problems.filter((p) => p.id !== daily?.id);
  return daily ? [daily, ...rest] : problems;
}

function normalizeTwoSum(output) {
  if (!Array.isArray(output) || output.length !== 2) return null;
  const [a, b] = output;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  return a < b ? [a, b] : [b, a];
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function runJsTests(problem, code) {
  const functionName = problem.functionName;
  if (!functionName) throw new Error('Problem missing functionName');

  // Harden the sandbox: no require, no process, no filesystem.
  const sandbox = {
    console: { log: () => {} },
    Math,
    Date,
    Array,
    Object,
    Number,
    String,
    Boolean,
    JSON,
    Map,
    Set,
    BigInt,
  };
  vm.createContext(sandbox);

  const wrapped = `
    "use strict";
    ${code}
    if (typeof ${functionName} !== "function") throw new Error("Expected a function named '${functionName}'.");
    globalThis.__solution__ = ${functionName};
  `;
  vm.runInContext(wrapped, sandbox, { timeout: 250 });

  const fn = sandbox.__solution__;
  const results = [];
  for (const t of problem.tests || []) {
    const started = Date.now();
    let out;
    let ok = false;
    let error = null;
    try {
      out = fn(...(t.input || []));
      if (problem.id === 'two-sum') ok = deepEqual(normalizeTwoSum(out), normalizeTwoSum(t.output));
      else ok = deepEqual(out, t.output);
    } catch (e) {
      error = e?.message || String(e);
      ok = false;
    }
    results.push({
      ok,
      ms: Date.now() - started,
      input: t.input,
      expected: t.output,
      output: out,
      error,
    });
  }
  const passed = results.filter((r) => r.ok).length;
  return { passed, total: results.length, results };
}

function computeReadiness(attempts) {
  // Minimal but meaningful score: pass rate + volume
  const total = attempts.length;
  const passed = attempts.filter((a) => a.result === 'pass').length;
  const passRate = total ? passed / total : 0;
  const volume = Math.min(1, total / 20);
  const score = Math.round(passRate * 70 + volume * 30);
  return Math.max(0, Math.min(100, score));
}

function weakTopicsFromAttempts(attempts) {
  const byTopic = new Map();
  for (const a of attempts) {
    const t = a.topic || 'General';
    const cur = byTopic.get(t) || { topic: t, tries: 0, passes: 0 };
    cur.tries += 1;
    if (a.result === 'pass') cur.passes += 1;
    byTopic.set(t, cur);
  }
  const rows = Array.from(byTopic.values()).map((r) => {
    const mastery = r.tries ? Math.round((r.passes / r.tries) * 100) : 0;
    return { topic: r.topic, mastery };
  });
  return rows.sort((a, b) => a.mastery - b.mastery).slice(0, 5);
}

function parseSkillBucket(arr) {
  const list = Array.isArray(arr) ? arr : [];
  return list.map((x) => String(x || '').trim()).filter(Boolean);
}

function topMissingSkillsFromActivity({ attempts = [], socratic = [], interviews = [] }) {
  const byTopic = new Map();
  attempts.forEach((a) => {
    const t = String(a.topic || '').trim();
    if (!t) return;
    const cur = byTopic.get(t) || { tries: 0, pass: 0 };
    cur.tries += 1;
    if (a.result === 'pass') cur.pass += 1;
    byTopic.set(t, cur);
  });
  socratic.forEach((s) => {
    const t = String(s.topic || '').trim();
    if (!t) return;
    const cur = byTopic.get(t) || { tries: 0, pass: 0 };
    cur.tries += 1;
    byTopic.set(t, cur);
  });
  const weak = Array.from(byTopic.entries())
    .map(([topic, v]) => ({ topic, score: v.tries ? v.pass / v.tries : 0 }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.topic)
    .slice(0, 8);
  const interviewHints = interviews
    .flatMap((s) => (s.assessment?.nextTopics || []))
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  return Array.from(new Set([...weak, ...interviewHints])).slice(0, 10);
}

function makeRoleIntelKey(goal, context = {}) {
  const g = String(goal || 'software engineer').trim().toLowerCase();
  const parts = [
    ...parseSkillBucket(context.resumeSkills || []).slice(0, 8),
    ...parseSkillBucket(context.missingSkills || []).slice(0, 8),
    ...parseSkillBucket(context.jdSkills || []).slice(0, 8),
  ]
    .map((x) => x.toLowerCase())
    .sort();
  const sig = parts.join('|').slice(0, 240);
  return `${g}__${sig || 'generic'}`;
}

async function runPdfExtractionWithLlmware(pdfPath) {
  const scriptPath = path.join(process.cwd(), 'ai_service', 'resume_pdf_extract.py');
  return new Promise((resolve, reject) => {
    const pyBin = process.env.PYTHON_BIN || 'python';
    const child = spawn(pyBin, [scriptPath, pdfPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += String(d || '');
    });
    child.stderr.on('data', (d) => {
      err += String(d || '');
    });
    child.on('error', (e) => reject(e));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `PDF parser exited with code ${code}`));
      try {
        const parsed = JSON.parse(out || '{}');
        resolve(parsed);
      } catch {
        reject(new Error('Failed to parse PDF extraction output'));
      }
    });
  });
}

async function runPdfExtractionFallback(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parsed = await pdfParse(buf);
  const text = String(parsed?.text || '').trim();
  const pageCount = Number(parsed?.numpages || 0);
  return { text, pageCount };
}

router.get('/dashboard', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const profile = await getOrCreateGamification(userId);
  const attempts = (await findAll(COL_ATTEMPTS, (a) => a.userId === userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);
  const readinessScore = computeReadiness(await findAll(COL_ATTEMPTS, (a) => a.userId === userId));
  const weakTopics = weakTopicsFromAttempts(attempts);
  const daily = pickDailyProblemForUser(userId);
  const dailyChallenge = daily
    ? { id: daily.id, title: `${daily.title} (Daily)`, bonusXp: 35, day: dayKey() }
    : null;
  res.json({ profile, readinessScore, weakTopics, recentAttempts: attempts, dailyChallenge });
});

router.get('/analytics/summary', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const allAttempts = await findAll(COL_ATTEMPTS, (a) => a.userId === userId);
  const interviews = await findAll(COL_INTERVIEWS, (a) => a.userId === userId);
  const visualizerRuns = await findAll('career_visualizer_runs', (a) => a.userId === userId);
  const profile = await getOrCreateGamification(userId);
  const readinessScore = computeReadiness(allAttempts);
  const submissions = allAttempts.filter((a) => a.kind === 'submit');
  const passed = submissions.filter((a) => a.result === 'pass').length;
  const passRate = submissions.length ? Math.round((passed / submissions.length) * 100) : 0;
  const sessions = [...submissions, ...interviews, ...visualizerRuns]
    .map((x) => x.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));
  res.json({
    world: 'career',
    profile,
    usage: {
      attempts: submissions.length,
      interviewSessions: interviews.length,
      visualizerRuns: visualizerRuns.length,
      totalTrackedActions: submissions.length + interviews.length + visualizerRuns.length,
      lastActiveAt: sessions[0] || null,
    },
    learning: {
      readinessScore,
      passRate,
      weakTopics: weakTopicsFromAttempts(allAttempts).slice(0, 4),
    },
  });
});

router.get('/problems', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const daily = pickDailyProblemForUser(userId);
  res.json({
    problems: rotateProblemsForDay(userId),
    dailyChallenge: daily ? { id: daily.id, title: daily.title, day: dayKey() } : null,
  });
});

router.get('/problems/:id', authMiddleware, async (req, res) => {
  const p = seedProblems().find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  res.json({ problem: p });
});

router.post('/hints', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { problemId, hintLevel = 1, userCode = '' } = req.body || {};
  const p = seedProblems().find((x) => x.id === problemId);
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  const level = Math.max(1, Math.min(3, Number(hintLevel) || 1));
  const system = `You are an elite DSA coach. Give progressive hints without spoiling unless level=3.\nReturn plain text only.\nRules:\n- Level 1: Socratic hint, no direct solution.\n- Level 2: Provide structure/pseudocode, still not full code.\n- Level 3: Full explanation including approach, edge cases, and complexity.`;
  const prompt = `Problem: ${p.title}\nPrompt:\n${p.prompt}\n\nStudent code (may be incomplete):\n${userCode}\n\nHint level: ${level}\nProvide the appropriate hint now.`;
  try {
    const hint = await callGroqChat(system, prompt, { maxTokens: 500 });
    // log “hint usage” as a lightweight attempt event for tracking
    await insertOne(COL_ATTEMPTS, {
      id: randomUUID(),
      userId,
      kind: 'hint',
      problemId,
      topic: p.topic,
      difficulty: p.difficulty,
      result: 'hint',
      hintLevel: level,
      createdAt: nowIso(),
    });
    res.json({ hint });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/attempts/submit', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { problemId, code = '', language = 'javascript' } = req.body || {};
  const p = seedProblems().find((x) => x.id === problemId);
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  if (!code?.trim()) return res.status(400).json({ error: 'code is required' });

  let judge = null;
  if (language === 'javascript') {
    try {
      judge = runJsTests(p, code);
    } catch (e) {
      judge = { passed: 0, total: (p.tests || []).length, results: [{ ok: false, error: e.message || String(e) }] };
    }
  }

  const system = `You are an expert DSA interviewer and code reviewer. Review the submission and return STRICT JSON only:
{
  "result": "pass" | "try",
  "summary": "string",
  "complexity": { "time": "string", "space": "string" },
  "edgeCases": ["..."],
  "codeQuality": ["..."],
  "nextSteps": ["..."]
}`;
  const prompt = `Problem: ${p.title}\nPrompt:\n${p.prompt}\n\nLanguage: ${language}\n\nJudging results (if available):\n${judge ? JSON.stringify(judge).slice(0, 6000) : 'N/A'}\n\nCode:\n${code}\n\nIf judging results show all tests passing, result MUST be "pass". If any test failed (or runtime error), result MUST be "try". Then explain why and how to fix.\nRespond with JSON only.`;

  try {
    const review = await callGeminiStructuredJSON(system, prompt, 1800);
    const forcedPass = judge && judge.total > 0 && judge.passed === judge.total;
    const result = forcedPass ? 'pass' : (review?.result === 'pass' ? 'pass' : 'try');
    const xpDelta = result === 'pass' ? 45 : 10;
    const profile = await awardXp(userId, xpDelta, 'career_attempt_submit', { world: WORLDS.career });
    await incrementQuest(userId, WORLDS.career, 'career_attempts', 1);

    const attempt = {
      id: randomUUID(),
      userId,
      kind: 'submit',
      problemId,
      problemTitle: p.title,
      topic: p.topic,
      difficulty: p.difficulty,
      language,
      code,
      result,
      xpDelta,
      createdAt: nowIso(),
      review,
      judge,
    };
    await insertOne(COL_ATTEMPTS, attempt);

    res.json({ profile, attemptId: attempt.id, review });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/attempts/run', authMiddleware, async (req, res) => {
  const { problemId, code = '', language = 'javascript' } = req.body || {};
  const p = seedProblems().find((x) => x.id === problemId);
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  if (!code?.trim()) return res.status(400).json({ error: 'code is required' });
  if (language !== 'javascript') return res.status(400).json({ error: 'Only javascript is supported in MVP runner' });
  try {
    const judge = runJsTests(p, code);
    res.json({ judge });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Visualizer AI narration helper (optional)
router.post('/visualizer/explain-step', authMiddleware, async (req, res) => {
  const { algoName, step } = req.body || {};
  if (!algoName || !step) return res.status(400).json({ error: 'algoName and step required' });
  const system = `You are an algorithm tutor. Explain what is happening in this step in plain language (1-2 sentences). Do not mention you cannot run code.`;
  const prompt = `Algorithm: ${algoName}\nStep: ${JSON.stringify(step).slice(0, 5000)}\nExplain now.`;
  try {
    const explanation = await callGroqChat(system, prompt, { maxTokens: 160 });
    res.json({ explanation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function findFirst(obj, predicate, depth = 0) {
  if (!obj || depth > 10) return null;
  if (predicate(obj)) return obj;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const r = findFirst(v, predicate, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const r = findFirst(obj[k], predicate, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

async function tryFetchLeetCode(url) {
  const u = String(url || '').trim();
  if (!u.includes('leetcode.com/problems/')) return null;
  const res = await fetch(u, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = ($('title').text() || '').replace(/\s+-\s+LeetCode\s*$/, '').trim();

  const nextDataRaw = $('#__NEXT_DATA__').text();
  let contentHtml = '';
  let constraintsText = '';
  let exampleText = '';
  if (nextDataRaw) {
    try {
      const nextData = JSON.parse(nextDataRaw);
      const q = findFirst(
        nextData,
        (x) =>
          x &&
          typeof x === 'object' &&
          typeof x.content === 'string' &&
          typeof x.title === 'string' &&
          (typeof x.titleSlug === 'string' || typeof x.questionId === 'string'),
      );
      contentHtml = String(q?.content || '');
      // constraints/examples are embedded inside content; keep raw HTML and let AI extract reliably.
    } catch {
      // ignore
    }
  }

  // Fallback: use visible text; it's imperfect but better than nothing.
  if (!contentHtml) {
    const meta = $('meta[name="description"]').attr('content') || '';
    contentHtml = meta ? `<p>${meta}</p>` : '';
  }

  return {
    source: 'leetcode',
    url: u,
    title: title || null,
    contentHtml: contentHtml || null,
    constraintsText: constraintsText || null,
    examplesText: exampleText || null,
  };
}

router.post('/visualizer/analyze', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const raw = String(req.body?.input || '').trim();
  if (!raw) return res.status(400).json({ error: 'input is required' });

  let fetched = null;
  try {
    fetched = await tryFetchLeetCode(raw);
  } catch (e) {
    console.warn('leetcode fetch failed:', e?.message);
    fetched = null;
  }

  const system = `You are an expert DSA teacher.
Return STRICT JSON only with this exact shape:
{
  "problem": {
    "title": "string",
    "description": "string",
    "constraints": ["string"],
    "examples": [{ "input": "string", "output": "string", "explanation": "string" }]
  },
  "pattern": {
    "name": "string",
    "ruleOfThumb": "string",
    "whenToUse": ["string"],
    "approach": ["string"],
    "recognitionHints": ["string"]
  },
  "visualization": {
    "primaryStructure": "array"|"linked_list"|"tree"|"graph"|"dp"|"stack"|"queue"|"sorting"|"mixed",
    "steps": [{
      "label": "string",
      "stepText": "string",
      "voiceText": "string",
      "state": {
        "array": [{"value": "string", "highlight": "none"|"active"|"compare"|"swap"|"window"}],
        "pointers": [{ "name":"string", "index": number, "color":"string" }],
        "window": { "l": number, "r": number, "ok": boolean },
        "stack": ["string"],
        "queue": ["string"],
        "dpGrid": { "rows": number, "cols": number, "cells": [{"r":number,"c":number,"value":"string","highlight":"none"|"active"|"done"}] },
        "graph": { "nodes":[{"id":"string","label":"string","state":"idle"|"frontier"|"visited"|"active"}], "edges":[{"from":"string","to":"string"}], "active":"string" },
        "tree": { "nodes":[{"id":"string","label":"string","state":"idle"|"active"|"visited"}], "edges":[{"from":"string","to":"string"}], "active":"string" }
      }
    }]
  },
  "final": {
    "language": "python",
    "code": "string",
    "complexity": { "time": "string", "space": "string", "explain": "string" },
    "similar": [{ "title": "string", "pattern": "string" }]
  }
}
Rules:
- voiceText must teach WHY, stepText states WHAT (keep them different).
- steps must be accurate for ONE chosen example (use first example).
- Keep steps <= 60 for performance.`;

  const prompt = `INPUT (URL or name): ${raw}
FETCHED (optional):
${fetched ? JSON.stringify(fetched).slice(0, 18000) : '(none)'}

If fetched.contentHtml exists, extract clean text problem statement, constraints, and examples from it.
Then pick the best pattern, produce an accurate step-by-step visualization script for example #1, and produce the optimal Python solution.
CRITICAL: At the end of the Python code, you MUST append a driver block that assigns sample inputs from example #1, calls the optimal solution function/method on those inputs, and prints the result, so the code is fully runnable and self-contained.`;

  try {
    const analysis = await callGeminiStructuredJSON(system, prompt, 8000);
    // lightweight progress XP
    await insertOne('career_visualizer_runs', { id: randomUUID(), userId, input: raw, createdAt: nowIso(), analysis });
    await awardXp(userId, 8, 'career_visualizer_run', { world: WORLDS.career });
    await incrementQuest(userId, WORLDS.career, 'career_visualizer_runs', 1);
    res.json(analysis);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to analyze problem' });
  }
});

router.post('/visualizer/trace', authMiddleware, async (req, res) => {
  const { code, language = 'python' } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code is required' });
  if (language.toLowerCase() !== 'python') {
    return res.status(400).json({ error: 'Only Python is supported for deterministic tracing.' });
  }

  try {
    const scriptPath = path.join(process.cwd(), 'ai_service', 'tracer.py');
    const pyBin = process.env.PYTHON_BIN || 'python';
    
    const child = spawn(pyBin, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let outStr = '';
    let errStr = '';

    child.stdout.on('data', (d) => { outStr += String(d || ''); });
    child.stderr.on('data', (d) => { errStr += String(d || ''); });

    child.stdin.write(JSON.stringify({ code }));
    child.stdin.end();

    child.on('close', (codeStatus) => {
      if (codeStatus !== 0 && !outStr) {
        return res.status(500).json({ error: errStr || `Tracer exited with code ${codeStatus}` });
      }
      try {
        const parsed = JSON.parse(outStr || '{}');
        if (parsed.error) {
             return res.status(400).json(parsed);
        }
        res.json(parsed);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse tracer output' });
      }
    });

    child.on('error', (e) => {
      res.status(500).json({ error: e.message || 'Failed to start tracer process' });
    });

  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to trace execution' });
  }
});

async function interviewRagContext(track) {
  const q =
    track === 'system'
      ? 'system design scalability caching sharding'
      : track === 'behavioral'
        ? 'behavioral interview STAR leadership conflict'
        : 'data structures algorithms complexity graphs trees';
  const chunks = await ragRetrieve(q, { mode: 'interview', k: 3 });
  return chunks.map((c) => c.text || '').join('\n---\n').slice(0, 8000);
}

// Interview Hub
router.post('/interview/start', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const {
    track = 'dsa',
    focusTopics = '',
    targetQuestions: tq = 5,
    difficulty = 'mid',
    companyStyle = 'general',
  } = req.body || {};
  const targetQuestions = Math.min(12, Math.max(3, Number(tq) || 5));
  const sessionId = randomUUID();
  let ragBits = '';
  try {
    ragBits = await interviewRagContext(track);
  } catch (e) {
    console.warn('interview RAG:', e?.message);
  }
  const system = `You are an AI mock interviewer. Ask ONE clear question only.
Track: ${track}. Difficulty: ${difficulty}. Company style to emulate: ${companyStyle}.
Ground questions in realistic interview patterns using CONTEXT as inspiration (do not copy verbatim).
Respond with ONLY valid JSON: {"question":"your first question text"}`;
  const focusLine = focusTopics ? `Student wants extra focus on: ${String(focusTopics).slice(0, 2000)}` : '';
  const prompt = `CONTEXT:\n${ragBits || '(none)'}\n\n${focusLine}\n\nThis is question 1 of ${targetQuestions} in the session. Open with an appropriate first question.`;
  try {
    let question;
    try {
      const parsed = await callGroqChatJSON(system, prompt, 320);
      question = typeof parsed?.question === 'string' ? parsed.question : null;
    } catch {
      question = null;
    }
    if (!question) {
      question = await callGroqChat(
        `You are a concise interviewer for ${track}. Return plain text: one opening question only.`,
        prompt,
        { maxTokens: 220 },
      );
    }
    const doc = {
      id: sessionId,
      userId,
      track,
      targetQuestions,
      difficulty,
      companyStyle,
      history: [{ role: 'assistant', content: question }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await insertOne(COL_INTERVIEWS, doc);
    res.json({ sessionId, question, targetQuestions, difficulty, companyStyle });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/interview/turn', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { sessionId, answer } = req.body || {};
  if (!sessionId || !answer) return res.status(400).json({ error: 'sessionId and answer required' });
  const session = await findOne(COL_INTERVIEWS, (s) => s.id === sessionId && s.userId === userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const targetQ = session.targetQuestions || 5;
  const nextHistory = [...(session.history || []), { role: 'user', content: answer }];
  const assistantCount = nextHistory.filter((m) => m.role === 'assistant').length;
  const userCount = nextHistory.filter((m) => m.role === 'user').length;

  if (userCount === targetQ && assistantCount === targetQ) {
    await updateOne(COL_INTERVIEWS, (s) => s.id === sessionId && s.userId === userId, { history: nextHistory, updatedAt: nowIso() });
    return res.json({
      complete: true,
      metrics: { confidence: 70, technical: 70, structure: 70, communication: 70, tip: 'Session complete — generate your full report.' },
      closingMessage: "That's the end of the planned question set. Click **End & Report** for your scorecard, radar chart, and improvement plan.",
    });
  }

  let ragBits = '';
  try {
    ragBits = await interviewRagContext(session.track);
  } catch {
    /* optional */
  }

  const nextQNum = assistantCount + 1;
  const system = `You are an AI interviewer. Read the conversation and the candidate's LAST answer.
Return ONLY valid JSON with this shape:
{
  "question": "next single interview question",
  "metrics": {
    "confidence": 0-100,
    "technical": 0-100,
    "structure": 0-100,
    "communication": 0-100,
    "tip": "one actionable sentence of feedback on their last answer"
  }
}
Rules: question must be one concise paragraph. Difficulty: ${session.difficulty || 'mid'}. Style: ${session.companyStyle || 'general'}.`;
  const prompt = `CONTEXT:\n${ragBits || '(none)'}\n\nTrack: ${session.track}\nQuestion ${nextQNum} of ${targetQ} (you are about to ask question ${nextQNum}).\nConversation:\n${nextHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n\nGenerate JSON now.`;

  try {
    let parsed;
    try {
      parsed = await callGroqChatJSON(system, prompt, 700);
    } catch {
      parsed = null;
    }
    let question = parsed?.question;
    let metrics = parsed?.metrics;
    if (!question || typeof question !== 'string') {
      question = await callGroqChat(
        `You are an interviewer. One follow-up question only. Plain text.`,
        prompt,
        { maxTokens: 260 },
      );
      metrics = { confidence: 60, technical: 60, structure: 60, communication: 60, tip: 'Keep answers structured and cite tradeoffs.' };
    }
    if (!metrics || typeof metrics !== 'object') {
      metrics = { confidence: 65, technical: 65, structure: 65, communication: 65, tip: 'Good effort — add complexity and edge cases next time.' };
    }
    nextHistory.push({ role: 'assistant', content: question });
    await updateOne(COL_INTERVIEWS, (s) => s.id === sessionId && s.userId === userId, { history: nextHistory, updatedAt: nowIso() });
    res.json({
      question,
      metrics: {
        confidence: Number(metrics.confidence) || 0,
        technical: Number(metrics.technical) || 0,
        structure: Number(metrics.structure) || 0,
        communication: Number(metrics.communication) || 0,
        tip: String(metrics.tip || ''),
      },
      turnIndex: nextQNum,
      targetQuestions: targetQ,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/interview/final', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const session = await findOne(COL_INTERVIEWS, (s) => s.id === sessionId && s.userId === userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const system = `You are an interview coach. Return STRICT JSON only:
{
  "overallScore": 0-100,
  "verdict": "Excellent"|"Good"|"Needs work",
  "grade": "A"|"B"|"C"|"D"|"F",
  "placementReadiness": "Ready"|"Not Ready"|"Borderline",
  "categoryScores": [
    { "name": "Problem Solving", "score": 0-100, "notes": "string" },
    { "name": "Communication", "score": 0-100, "notes": "string" },
    { "name": "Correctness & Edge Cases", "score": 0-100, "notes": "string" },
    { "name": "Complexity Awareness", "score": 0-100, "notes": "string" }
  ],
  "radar": { "technical": 0-100, "communication": 0-100, "confidence": 0-100, "structure": 0-100, "realtime": 0-100 },
  "questionReviews": [{ "index": 1, "prompt": "short", "score": 0-10, "feedback": "string" }],
  "improvementPlan": { "week1": "string", "week2": "string", "week3": "string" },
  "strengths": ["..."],
  "improvements": ["..."],
  "nextTopics": ["..."],
  "report": "2-3 paragraph markdown-like text"
}
Derive questionReviews from the assistant questions in the conversation (summarize each). Fill radar from your judgment of the whole session.`;
  const prompt = `Track: ${session.track}\nConversation:\n${(session.history || []).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n\nGenerate the assessment now.`;
  let assessment;
  try {
    assessment = await callGeminiStructuredJSON(system, prompt, 1200);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  await updateOne(COL_INTERVIEWS, (s) => s.id === sessionId && s.userId === userId, { assessment, updatedAt: nowIso() });
  // reward completion
  await awardXp(userId, 20, 'career_interview_complete', { world: WORLDS.career });
  res.json({ assessment });
});

router.get('/resume/profile', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const latest = await findOne(COL_RESUME_PROFILE, (x) => x.userId === userId);
  res.json({ profile: latest || null });
});

router.post('/resume/upload-pdf', authMiddleware, upload.single('resumePdf'), async (req, res) => {
  const userId = req.userId;
  if (!req.file) return res.status(400).json({ error: 'resumePdf file is required' });
  const mime = String(req.file.mimetype || '').toLowerCase();
  if (!mime.includes('pdf')) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'Only PDF files are supported' });
  }
  try {
    let parsed;
    try {
      parsed = await runPdfExtractionWithLlmware(req.file.path);
    } catch {
      // Robust local fallback so upload still works when llmware isn't installed.
      parsed = await runPdfExtractionFallback(req.file.path);
    }
    const extractedText = String(parsed?.text || '').trim().slice(0, 120000);
    const pageCount = Number(parsed?.pageCount || 0);
    if (!extractedText) {
      return res.status(422).json({ error: 'Could not extract text from this PDF. You can paste resume text manually instead.' });
    }
    const doc = {
      id: `${userId}__resume_profile`,
      userId,
      fileName: req.file.originalname || 'resume.pdf',
      pageCount: Number.isFinite(pageCount) ? pageCount : 0,
      extractedText,
      extractedPreview: extractedText.slice(0, 900),
      updatedAt: nowIso(),
      source: 'pdf',
    };
    const updated = await updateOne(COL_RESUME_PROFILE, (x) => x.userId === userId, doc);
    if (!updated) await insertOne(COL_RESUME_PROFILE, doc);
    res.json({ resume: doc });
  } catch (e) {
    res.status(500).json({
      error: `PDF extraction failed locally. ${e.message || ''}`.trim(),
      fallback: 'Paste resume text manually and continue analysis.',
    });
  } finally {
    try { fs.unlinkSync(req.file.path); } catch {}
  }
});

router.post('/resume/analyze', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { resumeText = '', goal = 'Software Engineer' } = req.body || {};
  const profile = await findOne(COL_RESUME_PROFILE, (x) => x.userId === userId);
  const text = String(resumeText || profile?.extractedText || '').slice(0, 120000);
  if (!text.trim()) return res.status(400).json({ error: 'resumeText required (paste extracted text for MVP)' });

  const [eduData, attempts, socraticSessions, interviews, visualizerRuns] = await Promise.all([
    findOne('edu_data', (x) => x.userId === userId),
    findAll(COL_ATTEMPTS, (x) => x.userId === userId),
    findAll('career_socratic_sessions', (x) => x.userId === userId),
    findAll(COL_INTERVIEWS, (x) => x.userId === userId),
    findAll('career_visualizer_runs', (x) => x.userId === userId),
  ]);
  const weakSkills = topMissingSkillsFromActivity({ attempts, socratic: socraticSessions, interviews });
  const activityFacts = {
    semester: eduData?.semester || 'unknown',
    educationLevel: eduData?.educationLevel || 'unknown',
    attempts: attempts.length,
    passedAttempts: attempts.filter((a) => a.result === 'pass').length,
    socraticTopics: socraticSessions.map((s) => s.topic).filter(Boolean).slice(0, 8),
    interviewSessions: interviews.length,
    visualizerRuns: visualizerRuns.length,
    weakSkills,
  };

  const system = `You analyze resumes for tech roles. Return STRICT JSON:
{
  "readinessScore": 0-100,
  "verdict": "ready" | "not_ready",
  "readyRoles": [{ "title": "string", "matchPercent": 0-100 }],
  "readyNow": [{ "title": "string", "matchPercent": 0-100 }],
  "reachableIn4Weeks": [{ "title": "string", "matchPercent": 0-100 }],
  "missing": [{ "area": "skills"|"projects"|"experience", "detail": "string" }],
  "prioritySkills": [{ "skill":"string","hours": number,"resource":"string" }],
  "alreadyReadyFor": [{ "title": "string", "reason": "string" }],
  "summary": "string"
}`;
  const prompt = `Career goal focus: ${goal}

USER PROFILE + ACTIVITY:
${JSON.stringify(activityFacts)}

RESUME TEXT:
${text}`;
  try {
    const analysis = await callGeminiStructuredJSON(system, prompt, 2500);
    const row = {
      id: randomUUID(),
      userId,
      goal,
      analysis,
      createdAt: nowIso(),
    };
    await insertOne(COL_RESUME, row);
    await awardXp(userId, 15, 'career_resume_analyze', { world: WORLDS.career });
    res.json({ analysis, savedId: row.id, profile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/resume/role-intelligence', authMiddleware, async (req, res) => {
  const goal = String(req.query.goal || 'Software Engineer');
  const cacheKey = makeRoleIntelKey(goal, {});
  const now = Date.now();
  const freshMs = 24 * 60 * 60 * 1000;
  const cached = await findOne(COL_ROLE_INTEL_CACHE, (x) => x.roleKey === cacheKey && x.userId === req.userId);
  if (cached?.updatedAt && (now - new Date(cached.updatedAt).getTime()) < freshMs) {
    return res.json({
      goal,
      tavilyOk: true,
      cached: true,
      fetchedAt: cached.updatedAt,
      intel: cached.intel,
    });
  }
  const tavily = await tavilySearch(
    `Real recruiter requirements and trending skills for ${goal} job postings now. Include AI skills like MCP, RAG, AI agents, copilots.`,
    { maxResults: 6 },
  );
  const system = `From SEARCH_ANSWER and BULLETS, produce STRICT JSON:
{
  "trends": ["string"],
  "recruiterWantsNow": [{ "skill":"string","reason":"string","twoWeekPlan":"string" }],
  "twoWeekRoadmap": [{ "skill": "string", "days": "string", "steps": ["string"] }]
}`;
  const bullets = (tavily.results || []).map((r) => `${r.title}: ${r.content || ''}`).join('\n');
  const prompt = `Goal: ${goal}\nSEARCH_ANSWER: ${tavily.answer || ''}\nBULLETS:\n${bullets.slice(0, 8000)}`;
  try {
    const intel = tavily.ok
      ? await callGeminiStructuredJSON(system, prompt, 1800)
      : { trends: ['Configure TAVILY_API_KEY for live market data'], twoWeekRoadmap: [] };
    if (tavily.ok) {
      const doc = {
        id: `role_intel__${cacheKey}`,
        userId: req.userId,
        roleKey: cacheKey,
        goal,
        intel,
        updatedAt: nowIso(),
      };
      const updated = await updateOne(COL_ROLE_INTEL_CACHE, (x) => x.roleKey === cacheKey, doc);
      if (!updated) await insertOne(COL_ROLE_INTEL_CACHE, doc);
      return res.json({ goal, tavilyOk: true, cached: false, fetchedAt: doc.updatedAt, intel });
    }
    if (cached) {
      return res.json({
        goal,
        tavilyOk: false,
        cached: true,
        fetchedAt: cached.updatedAt,
        intel: cached.intel,
        warning: 'Live Tavily fetch failed; showing cached market intel.',
      });
    }
    res.json({ goal, tavilyOk: false, cached: false, fetchedAt: nowIso(), intel });
  } catch (e) {
    if (cached) {
      return res.json({
        goal,
        tavilyOk: false,
        cached: true,
        fetchedAt: cached.updatedAt,
        intel: cached.intel,
        warning: 'Live generation failed; showing cached market intel.',
      });
    }
    res.status(500).json({ error: e.message });
  }
});

router.post('/resume/role-intelligence', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const {
    goal = 'Software Engineer',
    resumeSkills = [],
    missingSkills = [],
    jdSkills = [],
  } = req.body || {};
  const g = String(goal || 'Software Engineer');
  const context = {
    resumeSkills: parseSkillBucket(resumeSkills),
    missingSkills: parseSkillBucket(missingSkills),
    jdSkills: parseSkillBucket(jdSkills),
  };
  const cacheKey = makeRoleIntelKey(g, context);
  const now = Date.now();
  const freshMs = 24 * 60 * 60 * 1000;
  const cached = await findOne(COL_ROLE_INTEL_CACHE, (x) => x.roleKey === cacheKey && x.userId === userId);
  if (cached?.updatedAt && (now - new Date(cached.updatedAt).getTime()) < freshMs) {
    return res.json({
      goal: g,
      tavilyOk: true,
      cached: true,
      fetchedAt: cached.updatedAt,
      intel: cached.intel,
      personalized: true,
    });
  }

  const recruiterQuery = [
    `Real recruiter requirements for ${g} roles right now`,
    context.jdSkills.length ? `JD asks: ${context.jdSkills.join(', ')}` : '',
    context.missingSkills.length ? `Candidate gaps: ${context.missingSkills.join(', ')}` : '',
    'Include market demand, must-have stacks, and AI requirements like MCP/RAG/agents',
  ]
    .filter(Boolean)
    .join('. ');

  const tavily = await tavilySearch(recruiterQuery, { maxResults: 6 });
  const system = `From SEARCH_ANSWER and BULLETS, produce STRICT JSON:
{
  "trends": ["string"],
  "recruiterWantsNow": [{ "skill":"string","reason":"string","twoWeekPlan":"string" }],
  "whatToDoNow": [{ "action":"string","why":"string","impact":"high"|"medium"|"low" }],
  "twoWeekRoadmap": [{ "skill": "string", "days": "string", "steps": ["string"] }]
}`;
  const bullets = (tavily.results || []).map((r) => `${r.title}: ${r.content || ''}`).join('\n');
  const prompt = `Goal: ${g}
CANDIDATE CONTEXT:
${JSON.stringify(context)}
SEARCH_ANSWER: ${tavily.answer || ''}
BULLETS:
${bullets.slice(0, 9000)}`;

  try {
    const intel = tavily.ok
      ? await callGeminiStructuredJSON(system, prompt, 2200)
      : { trends: ['Tavily temporarily unavailable.'], recruiterWantsNow: [], whatToDoNow: [], twoWeekRoadmap: [] };

    if (tavily.ok) {
      const doc = {
        id: `role_intel__${userId}__${cacheKey}`,
        userId,
        roleKey: cacheKey,
        goal: g,
        intel,
        updatedAt: nowIso(),
      };
      const updated = await updateOne(COL_ROLE_INTEL_CACHE, (x) => x.roleKey === cacheKey && x.userId === userId, doc);
      if (!updated) await insertOne(COL_ROLE_INTEL_CACHE, doc);
      return res.json({ goal: g, tavilyOk: true, cached: false, fetchedAt: doc.updatedAt, intel, personalized: true });
    }

    if (cached) {
      return res.json({
        goal: g,
        tavilyOk: false,
        cached: true,
        fetchedAt: cached.updatedAt,
        intel: cached.intel,
        personalized: true,
        warning: 'Live Tavily fetch failed; showing cached personalized intel.',
      });
    }

    return res.json({ goal: g, tavilyOk: false, cached: false, fetchedAt: nowIso(), intel, personalized: true });
  } catch (e) {
    if (cached) {
      return res.json({
        goal: g,
        tavilyOk: false,
        cached: true,
        fetchedAt: cached.updatedAt,
        intel: cached.intel,
        personalized: true,
        warning: 'Live generation failed; showing cached personalized intel.',
      });
    }
    return res.status(500).json({ error: e.message || 'Failed personalized role intelligence' });
  }
});

router.post('/resume/jd-scan', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { jdText = '', resumeText = '' } = req.body || {};
  const profile = await findOne(COL_RESUME_PROFILE, (x) => x.userId === userId);
  const eduData = await findOne('edu_data', (x) => x.userId === userId);
  const socratic = await findAll('career_socratic_sessions', (x) => x.userId === userId);
  const attempts = await findAll(COL_ATTEMPTS, (x) => x.userId === userId);
  const jd = String(jdText || '').slice(0, 60000);
  const resume = String(resumeText || profile?.extractedText || '').slice(0, 120000);
  if (!jd.trim()) return res.status(400).json({ error: 'jdText required' });
  if (!resume.trim()) return res.status(400).json({ error: 'No resume text found. Upload PDF or paste text first.' });

  let chunks = [];
  try {
    chunks = await ragRetrieve(jd.slice(0, 2000), { mode: 'jd', k: 3 });
  } catch {
    /* fallback OK */
  }
  const resumeHints = chunks.length ? chunks.map((c) => c.text).join('\n---\n').slice(0, 6000) : resume.slice(0, 4000);

  const system = `Compare JOB DESCRIPTION to RESUME line-by-line. Return STRICT JSON:
{
  "matchScore": 0-100,
  "matchedSkills": ["string"],
  "partialSkills": ["string"],
  "missingSkills": ["string"],
  "green": ["string"],
  "yellow": ["string"],
  "red": ["string"],
  "resources": [{ "skill":"string","url":"string","title":"string" }],
  "weakSections": ["string"],
  "starRewrites": [{ "before": "string", "after": "string", "rationale": "string" }],
  "interviewPrepTopics": ["string"]
}`;
  const prompt = `JOB DESCRIPTION:\n${jd}\n\nRESUME:\n${resume}\n\nNOTES_FROM_RAG_CHUNKS (may be partial):\n${resumeHints}

USER CONTEXT:
${JSON.stringify({
    semester: eduData?.semester || null,
    targetRole: profile?.goal || null,
    attempts: attempts.length,
    socraticTopics: socratic.map((s) => s.topic).filter(Boolean).slice(0, 10),
  })}`;
  try {
    const scan = await callGeminiStructuredJSON(system, prompt, 3000);
    const row = { id: randomUUID(), userId, scan, createdAt: nowIso() };
    await insertOne(COL_JD, row);
    await awardXp(userId, 12, 'career_jd_scan', { world: WORLDS.career });
    res.json({ scan, savedId: row.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/resume/application-kit', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { jdText = '', resumeText = '', targetRole = '' } = req.body || {};
  const jd = String(jdText || '').slice(0, 60000);
  const resume = String(resumeText || '').slice(0, 120000);
  const role = String(targetRole || '').trim().slice(0, 120);
  if (!jd.trim()) return res.status(400).json({ error: 'jdText required' });
  if (!resume.trim()) return res.status(400).json({ error: 'resumeText required' });

  const system = `You are an expert ATS resume strategist and job application writer.
Return STRICT JSON only:
{
  "profileSummary": "string",
  "atsKeywords": ["string"],
  "skillsToHighlight": ["string"],
  "experienceBullets": ["string"],
  "coverLetter": {
    "subject": "string",
    "body": "string"
  },
  "outreachDrafts": {
    "email": "string",
    "linkedin": "string"
  },
  "interviewFocus": ["string"]
}
Rules:
- Tailor tightly to JD.
- Keep experience bullets measurable and action-oriented.
- Keep outreach concise and natural.`;
  const prompt = `TARGET ROLE: ${role || 'Not provided'}

JOB DESCRIPTION:
${jd}

RESUME:
${resume}
`;
  try {
    const kit = await callGeminiStructuredJSON(system, prompt, 3200);
    const row = {
      id: randomUUID(),
      userId,
      targetRole: role || null,
      jdText: jd.slice(0, 10000),
      kit,
      createdAt: nowIso(),
    };
    await insertOne(COL_APP_KIT, row);
    await awardXp(userId, 18, 'career_application_kit', { world: WORLDS.career });
    res.json({ kit, savedId: row.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/resume/recruiter-sim/start', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { resumeText = '', goal = 'Software Engineer' } = req.body || {};
  const profile = await findOne(COL_RESUME_PROFILE, (x) => x.userId === userId);
  const text = String(resumeText || profile?.extractedText || '').slice(0, 120000);
  if (!text.trim()) return res.status(400).json({ error: 'Resume text is required for recruiter simulation.' });
  const recentSessions = (await findAll(COL_RECRUITER_SIM, (x) => x.userId === userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);
  const avoidQuestions = recentSessions.flatMap((s) => s.questions || []).slice(0, 15);
  const variationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const system = `You are a strict recruiter doing a first screening call. Return STRICT JSON:
{
  "questions": ["q1","q2","q3","q4","q5"]
}
Questions must be specific to the candidate's resume bullets and target role.
Do not repeat any question listed in AVOID_QUESTIONS. Make wording fresh and scenario-specific.`;
  const prompt = `TARGET ROLE: ${goal}
VARIATION_SEED: ${variationSeed}
AVOID_QUESTIONS: ${JSON.stringify(avoidQuestions)}
RESUME:
${text}`;
  try {
    const data = await callGeminiStructuredJSON(system, prompt, 1200);
    const questions = Array.isArray(data?.questions) ? data.questions.slice(0, 5).map((q) => String(q || '').trim()).filter(Boolean) : [];
    if (questions.length < 5) return res.status(500).json({ error: 'Could not generate 5 recruiter questions.' });
    const session = {
      id: randomUUID(),
      userId,
      goal,
      resumeVersion: profile?.updatedAt || null,
      resumeText: text.slice(0, 25000),
      questions,
      answers: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await insertOne(COL_RECRUITER_SIM, session);
    res.json({ sessionId: session.id, questions });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to start recruiter sim' });
  }
});

router.post('/resume/recruiter-sim/complete', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { sessionId = '', answers = [] } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const session = await findOne(COL_RECRUITER_SIM, (x) => x.userId === userId && x.id === sessionId);
  if (!session) return res.status(404).json({ error: 'Recruiter sim session not found' });
  if (!Array.isArray(answers) || answers.length < 5) return res.status(400).json({ error: 'Five answers are required' });

  const system = `You are a real recruiter giving candid feedback. Return STRICT JSON:
{
  "whatImpressed": ["string"],
  "whatRaisedDoubts": ["string"],
  "resumeFixes": [{ "issue":"string", "fix":"string" }],
  "answerImprovements": [{ "question":"string", "yourAnswer":"string", "improvedAnswer":"string", "why":"string" }],
  "overallVerdict": "string"
}`;
  const prompt = `TARGET ROLE: ${session.goal}
QUESTIONS: ${JSON.stringify(session.questions)}
ANSWERS: ${JSON.stringify(answers).slice(0, 18000)}
RESUME:
${String(session.resumeText || '').slice(0, 18000)}`;
  try {
    const feedback = await callGeminiStructuredJSON(system, prompt, 1800);
    const updated = {
      ...session,
      answers: answers.slice(0, 5).map((x) => String(x || '').slice(0, 4000)),
      feedback,
      completedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await updateOne(COL_RECRUITER_SIM, (x) => x.id === sessionId && x.userId === userId, updated);
    await awardXp(userId, 75, 'career_recruiter_sim_complete', { world: WORLDS.career });
    res.json({ feedback, xpAwarded: 75 });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to complete recruiter sim' });
  }
});

// Rooms (MVP polling-based)
function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

router.post('/rooms/create', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = randomUUID();
  const roomCode = makeRoomCode();
  const room = {
    id: roomId,
    roomId,
    roomCode,
    ownerId: userId,
    participants: [{ userId, joinedAt: nowIso() }],
    status: { phase: 'lobby', winner: null },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await insertOne(COL_ROOMS, room);
  res.json({ roomId, roomCode, participants: room.participants, status: room.status });
});

router.post('/rooms/join', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ error: 'roomCode required' });
  const room = await findOne(COL_ROOMS, (r) => String(r.roomCode) === String(roomCode).toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const participants = room.participants || [];
  if (!participants.some((p) => p.userId === userId)) participants.push({ userId, joinedAt: nowIso() });
  await updateOne(COL_ROOMS, (r) => r.roomId === room.roomId, { participants, updatedAt: nowIso() });
  res.json({ roomId: room.roomId, roomCode: room.roomCode, participants, status: room.status || { phase: 'lobby' } });
});

router.get('/rooms/:roomId', authMiddleware, async (req, res) => {
  const room = await findOne(COL_ROOMS, (r) => r.roomId === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ roomId: room.roomId, roomCode: room.roomCode, participants: room.participants || [], status: room.status || {} });
});

router.post('/rooms/:roomId/start', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const room = await findOne(COL_ROOMS, (r) => r.roomId === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.ownerId !== userId) return res.status(403).json({ error: 'Only host can start' });
  const problems = seedProblems();
  const problem = problems[Math.floor(Math.random() * problems.length)];
  const status = {
    phase: 'active',
    problemId: problem.id,
    problemTitle: problem.title,
    winner: null,
    submissions: {},
    startedAt: nowIso(),
  };
  await updateOne(COL_ROOMS, (r) => r.roomId === room.roomId, { status, updatedAt: nowIso() });
  res.json({ status, problem: { id: problem.id, title: problem.title, topic: problem.topic, difficulty: problem.difficulty, prompt: problem.prompt, starterCode: problem.starterCode, functionName: problem.functionName } });
});

router.post('/rooms/:roomId/submit', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { code = '', language = 'javascript' } = req.body || {};
  const room = await findOne(COL_ROOMS, (r) => r.roomId === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const st = room.status || {};
  if (st.phase !== 'active' || !st.problemId) return res.status(400).json({ error: 'Room not active' });
  if (st.winner) return res.json({ result: 'done', winner: st.winner, status: st });

  const p = seedProblems().find((x) => x.id === st.problemId);
  if (!p) return res.status(400).json({ error: 'Problem missing' });

  let judge = null;
  if (language === 'javascript') {
    try {
      judge = runJsTests(p, code);
    } catch (e) {
      judge = { passed: 0, total: (p.tests || []).length, error: e.message };
    }
  } else {
    return res.status(400).json({ error: 'Only javascript supported in duel MVP' });
  }

  const passed = judge && judge.total > 0 && judge.passed === judge.total;
  const submissions = { ...(st.submissions || {}), [userId]: { passed, at: nowIso(), judge } };

  let winner = st.winner;
  if (passed && !winner) {
    winner = userId;
    await awardXp(userId, 90, 'career_duel_win', { world: WORLDS.career });
  }

  const nextStatus = {
    ...st,
    phase: winner ? 'done' : 'active',
    winner: winner || null,
    submissions,
  };

  await updateOne(COL_ROOMS, (r) => r.roomId === room.roomId, { status: nextStatus, updatedAt: nowIso() });

  if (passed && winner === userId) {
    await insertOne(COL_ATTEMPTS, {
      id: randomUUID(),
      userId,
      kind: 'duel-win',
      problemId: p.id,
      problemTitle: p.title,
      topic: p.topic,
      difficulty: p.difficulty,
      result: 'pass',
      xpDelta: 90,
      createdAt: nowIso(),
    });
  }

  res.json({ passed, judge, winner, status: nextStatus });
});

export default router;

