import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { findAll, readDB, writeDB } from '../middleware/db.js';
import { callGeminiJSON } from '../services/gemini.js';
import { awardXp, listLeaderboard } from '../services/gamificationCore.js';

const router = express.Router();

function weekKey() {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - onejan) / 86400000);
  const week = Math.ceil((days + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

/** GET /api/study/arena/summary */
router.get('/summary', authMiddleware, (req, res) => {
  const duels = findAll('arena_duels', (d) => d.userA === req.userId || d.userB === req.userId);
  const squads = findAll('arena_squads', (s) => (s.memberIds || []).includes(req.userId));
  const boss = readDB('arena_boss_cache').find((b) => b.week === weekKey()) || null;
  res.json({ duels: duels.slice(-10), squads, bossWeek: weekKey(), boss });
});

/** POST /api/study/arena/duel/create */
router.post('/duel/create', authMiddleware, async (req, res) => {
  try {
    const { topic } = req.body;
    const system = `Output ONLY JSON: {"questions":[{"q":"...","options":["","","",""],"answer":"","id":"1"}]} — exactly 5 questions.`;
    const pack = await callGeminiJSON(system, `Topic: ${topic || 'General knowledge'}`, 4096);
    const rawQs = pack.questions || [];
    const questions = rawQs.map((q, i) => ({
      id: String(q.id || i + 1),
      q: q.q || q.question || '',
      question: q.q || q.question || '',
      options: q.options || ['A', 'B', 'C', 'D'],
      answer: q.answer || '',
    }));
    const duel = {
      id: uuidv4(),
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      userA: req.userId,
      userB: null,
      topic: topic || 'Mixed',
      questions,
      scores: {},
      status: 'waiting',
      createdAt: new Date().toISOString(),
    };
    const all = readDB('arena_duels');
    all.push(duel);
    writeDB('arena_duels', all);
    res.json({ duel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/study/arena/duel/join */
router.post('/duel/join', authMiddleware, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  const all = readDB('arena_duels');
  const idx = all.findIndex((d) => d.code === String(code).toUpperCase() && d.status === 'waiting');
  if (idx === -1) return res.status(404).json({ error: 'Invalid code' });
  if (all[idx].userA === req.userId) return res.status(400).json({ error: 'Cannot join own duel' });
  all[idx].userB = req.userId;
  all[idx].status = 'active';
  writeDB('arena_duels', all);
  res.json({ duel: all[idx] });
});

/** POST /api/study/arena/duel/:id/submit */
router.post('/duel/:id/submit', authMiddleware, (req, res) => {
  const { answers } = req.body;
  const all = readDB('arena_duels');
  const idx = all.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const d = all[idx];
  if (d.userA !== req.userId && d.userB !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  let correct = 0;
  for (let i = 0; i < (d.questions || []).length; i++) {
    const q = d.questions[i];
    const a = answers?.[q.id] ?? answers?.[i];
    if (String(a).trim() === String(q.answer).trim()) correct++;
  }
  d.scores[req.userId] = correct;
  if (Object.keys(d.scores).length >= 2) d.status = 'done';
  writeDB('arena_duels', all);
  if (d.status === 'done') {
    const entries = Object.entries(d.scores);
    entries.sort((a, b) => b[1] - a[1]);
    if (entries[0][0] === req.userId) awardXp(req.userId, 40, 'duel_win');
    awardXp(req.userId, 15, 'duel_play');
  }
  res.json({ correct, total: d.questions.length, scores: d.scores, status: d.status });
});

/** GET /api/study/arena/boss — weekly hard quiz */
router.get('/boss', authMiddleware, async (req, res) => {
  try {
    const wk = weekKey();
    let cache = readDB('arena_boss_cache').find((b) => b.week === wk);
    if (!cache) {
      const system = `Output ONLY JSON: {"title":"...","questions":[{"id":"1","q":"...","options":["","","",""],"answer":""}]} — exactly 10 hard MCQs.`;
      const pack = await callGeminiJSON(system, 'Computer science / mixed STEM difficulty for advanced undergrads', 8192);
      const qs = (pack.questions || []).map((q, i) => ({
        id: String(q.id || i + 1),
        q: q.q || q.question || '',
        question: q.q || q.question || '',
        options: q.options || ['A', 'B', 'C', 'D'],
        answer: q.answer || '',
      }));
      cache = { week: wk, title: pack.title || 'Boss Challenge', questions: qs };
      const all = readDB('arena_boss_cache');
      all.push(cache);
      writeDB('arena_boss_cache', all);
    }
    const attempts = findAll('arena_boss_attempts', (a) => a.userId === req.userId && a.week === wk);
    res.json({ boss: cache, myAttempts: attempts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/study/arena/boss/submit */
router.post('/boss/submit', authMiddleware, (req, res) => {
  const { answers } = req.body;
  const wk = weekKey();
  const cache = readDB('arena_boss_cache').find((b) => b.week === wk);
  if (!cache) return res.status(400).json({ error: 'No boss this week' });
  let correct = 0;
  for (let i = 0; i < (cache.questions || []).length; i++) {
    const q = cache.questions[i];
    const a = answers?.[q.id] ?? answers?.[i];
    if (String(a).trim() === String(q.answer).trim()) correct++;
  }
  const row = {
    id: uuidv4(),
    userId: req.userId,
    week: wk,
    score: correct,
    total: cache.questions.length,
    at: new Date().toISOString(),
  };
  const all = readDB('arena_boss_attempts');
  all.push(row);
  writeDB('arena_boss_attempts', all);
  awardXp(req.userId, Math.max(20, correct * 5), 'boss');
  res.json({ score: correct, total: cache.questions.length });
});

/** POST /api/study/arena/squad/create */
router.post('/squad/create', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const squad = {
    id: uuidv4(),
    name: name.trim(),
    invite: Math.random().toString(36).slice(2, 10).toUpperCase(),
    memberIds: [req.userId],
    challengeProgress: 0,
    challengeTarget: 50,
    createdAt: new Date().toISOString(),
  };
  const all = readDB('arena_squads');
  all.push(squad);
  writeDB('arena_squads', all);
  res.json({ squad });
});

/** POST /api/study/arena/squad/join */
router.post('/squad/join', authMiddleware, (req, res) => {
  const { invite } = req.body;
  const all = readDB('arena_squads');
  const idx = all.findIndex((s) => s.invite === String(invite).toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Invalid invite' });
  const s = all[idx];
  if ((s.memberIds || []).includes(req.userId)) return res.json({ squad: s });
  if ((s.memberIds || []).length >= 5) return res.status(400).json({ error: 'Squad full' });
  s.memberIds.push(req.userId);
  writeDB('arena_squads', all);
  res.json({ squad: s });
});

/** POST /api/study/arena/squad/:id/progress */
router.post('/squad/:id/progress', authMiddleware, (req, res) => {
  const { delta } = req.body;
  const all = readDB('arena_squads');
  const idx = all.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const s = all[idx];
  if (!(s.memberIds || []).includes(req.userId)) return res.status(403).json({ error: 'Not a member' });
  s.challengeProgress = Math.min(s.challengeTarget || 50, (s.challengeProgress || 0) + (Number(delta) || 1));
  writeDB('arena_squads', all);
  if (s.challengeProgress >= (s.challengeTarget || 50)) awardXp(req.userId, 30, 'squad_week');
  res.json({ squad: s });
});

/** GET /api/study/arena/leaderboard */
router.get('/leaderboard', authMiddleware, (req, res) => {
  res.json({ leaderboard: listLeaderboard(30) });
});

export default router;