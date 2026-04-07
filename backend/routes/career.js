import express from 'express';
import { randomUUID } from 'crypto';
import vm from 'vm';
import { authMiddleware } from '../middleware/auth.js';
import { callGroqChat, callGroqChatJSON, callGeminiStructuredJSON } from '../services/careerAi.js';
import { ragRetrieve } from '../services/ragLocal.js';
import { tavilySearch } from '../services/tavily.js';
import { findAll, findOne, insertOne, upsertOne, updateOne } from '../middleware/db.js';

const router = express.Router();

const COL_PROFILE = 'career_profile';
const COL_ATTEMPTS = 'career_problem_attempts';
const COL_TOPIC_STATE = 'career_topic_state';
const COL_ROOMS = 'career_rooms';
const COL_INTERVIEWS = 'career_interviews';
const COL_RESUME = 'career_resume_intel';
const COL_JD = 'career_jd_scans';

function nowIso() {
  return new Date().toISOString();
}

function computeLevel(xp) {
  // simple curve: every 250xp = +1 level
  return Math.max(1, Math.floor((xp || 0) / 250) + 1);
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function getOrInitProfile(userId) {
  const existing = await findOne(COL_PROFILE, (p) => p.userId === userId);
  if (existing) return existing;
  const profile = { id: userId, userId, xp: 0, level: 1, streak: 0, lastActiveDate: null, createdAt: nowIso(), updatedAt: nowIso() };
  await insertOne(COL_PROFILE, profile);
  return profile;
}

async function awardXpAndStreak(userId, deltaXp) {
  const profile = await getOrInitProfile(userId);
  const today = dayKey();
  const last = profile.lastActiveDate;
  let streak = profile.streak || 0;
  if (!last) streak = 1;
  else {
    const lastDate = new Date(last);
    const diffDays = Math.floor((new Date(today) - new Date(dayKey(lastDate))) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      // same day, keep streak
    } else if (diffDays === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
  }
  const xp = (profile.xp || 0) + (deltaXp || 0);
  const level = computeLevel(xp);
  const updated = await updateOne(
    COL_PROFILE,
    (p) => p.userId === userId,
    { xp, level, streak, lastActiveDate: today, updatedAt: nowIso() },
  );
  return updated || { ...profile, xp, level, streak, lastActiveDate: today, updatedAt: nowIso() };
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

function conceptMapSeed() {
  return {
    nodes: [
      { id: 'arrays', label: 'Arrays', description: 'Core iteration, indexing, prefix sums.', x: 140, y: 110 },
      { id: 'hashing', label: 'Hashing', description: 'Maps/sets for \(O(1)\) lookups.', x: 320, y: 110 },
      { id: 'two-pointers', label: 'Two pointers', description: 'Inward/outward pointer patterns.', x: 500, y: 110 },
      { id: 'stacks', label: 'Stacks', description: 'Monotonic stack, parsing, next greater.', x: 230, y: 250 },
      { id: 'binary-search', label: 'Binary search', description: 'Search on answer; invariants.', x: 410, y: 250 },
      { id: 'graphs', label: 'Graphs', description: 'BFS/DFS, shortest paths.', x: 620, y: 250 },
      { id: 'dp', label: 'DP', description: 'Optimal substructure; transitions.', x: 740, y: 120 },
    ],
    edges: [
      { from: 'arrays', to: 'hashing' },
      { from: 'arrays', to: 'two-pointers' },
      { from: 'hashing', to: 'stacks' },
      { from: 'two-pointers', to: 'binary-search' },
      { from: 'binary-search', to: 'graphs' },
      { from: 'graphs', to: 'dp' },
    ],
  };
}

function computeReadiness(attempts, topicState) {
  // Minimal but meaningful score: pass rate + volume + topic completions
  const total = attempts.length;
  const passed = attempts.filter((a) => a.result === 'pass').length;
  const passRate = total ? passed / total : 0;
  const volume = Math.min(1, total / 20);
  const completedTopics = topicState.filter((t) => t.status === 'mastered' || t.status === 'completed').length;
  const topicFactor = Math.min(1, completedTopics / 8);
  const score = Math.round((passRate * 55 + volume * 25 + topicFactor * 20));
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

router.get('/dashboard', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const profile = await getOrInitProfile(userId);
  const attempts = (await findAll(COL_ATTEMPTS, (a) => a.userId === userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);
  const topicState = await findAll(COL_TOPIC_STATE, (t) => t.userId === userId);
  const readinessScore = computeReadiness(await findAll(COL_ATTEMPTS, (a) => a.userId === userId), topicState);
  const weakTopics = weakTopicsFromAttempts(attempts);
  const dailyChallenge = { id: 'two-sum', title: 'Two Sum (Daily)', bonusXp: 35 };
  res.json({ profile, readinessScore, weakTopics, recentAttempts: attempts, dailyChallenge });
});

router.get('/problems', authMiddleware, async (_req, res) => {
  // MVP: static seed
  res.json({ problems: seedProblems() });
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
    const profile = await awardXpAndStreak(userId, xpDelta);

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

router.get('/concept-map', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const seed = conceptMapSeed();
  const states = await findAll(COL_TOPIC_STATE, (t) => t.userId === userId);
  const mapState = new Map(states.map((s) => [s.topicId, s.status]));
  const nodes = seed.nodes.map((n) => ({ ...n, status: mapState.get(n.id) || 'not_started' }));
  res.json({ nodes, edges: seed.edges });
});

router.post('/concept-map/state', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { topicId, status } = req.body || {};
  if (!topicId || !status) return res.status(400).json({ error: 'topicId and status required' });
  const allowed = new Set(['not_started', 'learning', 'mastered', 'review', 'completed']);
  if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid status' });

  const doc = { id: `${userId}__${topicId}`, userId, topicId, status, updatedAt: nowIso() };
  await upsertOne(COL_TOPIC_STATE, (t) => t.userId === userId && t.topicId === topicId, doc);
  res.json({ ok: true });
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
  await awardXpAndStreak(userId, 20);
  res.json({ assessment });
});

router.post('/concept-map/lesson', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { topicId, label } = req.body || {};
  if (!topicId) return res.status(400).json({ error: 'topicId required' });
  const seed = conceptMapSeed();
  const node = seed.nodes.find((n) => n.id === topicId);
  const title = label || node?.label || topicId;
  const q = `${title} ${node?.description || ''}`.trim();

  let chunks = [];
  try {
    chunks = await ragRetrieve(q, { mode: 'topics', k: 4 });
  } catch (e) {
    console.warn('concept lesson RAG:', e?.message);
  }
  const context = chunks.length
    ? chunks.map((c, i) => `SOURCE ${i + 1}:\n${c.text}`).join('\n\n')
    : node?.description || '';

  const system = `You are a concise DSA/career tutor. Teach from CONTEXT; if CONTEXT is thin, use standard knowledge but say so briefly.
Return plain text: 4-6 short paragraphs with bullets where useful. No markdown code fences.`;
  const prompt = `Topic: ${title}\n\nCONTEXT:\n${context.slice(0, 12000)}\n\nWrite the mini-lesson.`;

  try {
    const lesson = await callGroqChat(system, prompt, { maxTokens: 900 });
    await awardXpAndStreak(userId, 5);
    res.json({ lesson, sources: chunks.map((c) => c.source || c.path).filter(Boolean) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/resume/analyze', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { resumeText = '', goal = 'Software Engineer' } = req.body || {};
  const text = String(resumeText || '').slice(0, 120000);
  if (!text.trim()) return res.status(400).json({ error: 'resumeText required (paste extracted text for MVP)' });

  const system = `You analyze resumes for tech roles. Return STRICT JSON:
{
  "readinessScore": 0-100,
  "verdict": "ready" | "not_ready",
  "readyRoles": [{ "title": "string", "matchPercent": 0-100 }],
  "missing": [{ "area": "skills"|"projects"|"experience", "detail": "string" }],
  "alreadyReadyFor": [{ "title": "string", "reason": "string" }],
  "summary": "string"
}`;
  const prompt = `Career goal focus: ${goal}\n\nRESUME TEXT:\n${text}`;
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
    await awardXpAndStreak(userId, 15);
    res.json({ analysis, savedId: row.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/resume/role-intelligence', authMiddleware, async (req, res) => {
  const goal = String(req.query.goal || 'Software Engineer');
  const tavily = await tavilySearch(`What skills and tools do technical recruiters expect for ${goal} roles in 2025 2026 beyond core CS`, {
    maxResults: 5,
  });
  const system = `From SEARCH_ANSWER and BULLETS, produce STRICT JSON:
{
  "trends": ["string"],
  "twoWeekRoadmap": [{ "skill": "string", "days": "string", "steps": ["string"] }]
}`;
  const bullets = (tavily.results || []).map((r) => `${r.title}: ${r.content || ''}`).join('\n');
  const prompt = `Goal: ${goal}\nSEARCH_ANSWER: ${tavily.answer || ''}\nBULLETS:\n${bullets.slice(0, 8000)}`;
  try {
    const intel = tavily.ok
      ? await callGeminiStructuredJSON(system, prompt, 1800)
      : { trends: ['Configure TAVILY_API_KEY for live market data'], twoWeekRoadmap: [] };
    res.json({ goal, tavilyOk: tavily.ok, intel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/resume/jd-scan', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { jdText = '', resumeText = '' } = req.body || {};
  const jd = String(jdText || '').slice(0, 60000);
  const resume = String(resumeText || '').slice(0, 120000);
  if (!jd.trim()) return res.status(400).json({ error: 'jdText required' });

  let chunks = [];
  try {
    chunks = await ragRetrieve(jd.slice(0, 2000), { mode: 'jd', k: 3 });
  } catch {
    /* fallback OK */
  }
  const resumeHints = chunks.length ? chunks.map((c) => c.text).join('\n---\n').slice(0, 6000) : resume.slice(0, 4000);

  const system = `Compare JOB DESCRIPTION to RESUME. Return STRICT JSON:
{
  "matchScore": 0-100,
  "matchedSkills": ["string"],
  "missingSkills": ["string"],
  "weakSections": ["string"],
  "starRewrites": [{ "before": "string", "after": "string", "rationale": "string" }]
}`;
  const prompt = `JOB DESCRIPTION:\n${jd}\n\nRESUME:\n${resume}\n\nNOTES_FROM_RAG_CHUNKS (may be partial):\n${resumeHints}`;
  try {
    const scan = await callGeminiStructuredJSON(system, prompt, 3000);
    const row = { id: randomUUID(), userId, scan, createdAt: nowIso() };
    await insertOne(COL_JD, row);
    await awardXpAndStreak(userId, 12);
    res.json({ scan, savedId: row.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    await awardXpAndStreak(userId, 90);
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

