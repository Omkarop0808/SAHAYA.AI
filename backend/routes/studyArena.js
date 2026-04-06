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

router.get('/summary', authMiddleware, async (req, res) => {
  const duels = await findAll('arena_duels', (d) => d.userA === req.userId || d.userB === req.userId);
  const squads = await findAll('arena_squads', (s) => (s.memberIds || []).includes(req.userId));
  const bossCache = await readDB('arena_boss_cache');
  const boss = bossCache.find((b) => b.week === weekKey()) || null;
  res.json({ duels: duels.slice(-10), squads, bossWeek: weekKey(), boss });
});

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
    const all = await readDB('arena_duels');
    all.push(duel);
    await writeDB('arena_duels', all);
    res.json({ duel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/duel/join', authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  const all = await readDB('arena_duels');
  const idx = all.findIndex((d) => d.code === String(code).toUpperCase() && d.status === 'waiting');
  if (idx === -1) return res.status(404).json({ error: 'Invalid code' });
  if (all[idx].userA === req.userId) return res.status(400).json({ error: 'Cannot join own duel' });
  all[idx].userB = req.userId;
  all[idx].status = 'active';
  await writeDB('arena_duels', all);
  res.json({ duel: all[idx] });
});

router.post('/duel/:id/submit', authMiddleware, async (req, res) => {
  const { answers } = req.body;
  const all = await readDB('arena_duels');
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
  await writeDB('arena_duels', all);
  if (d.status === 'done') {
    const entries = Object.entries(d.scores);
    entries.sort((a, b) => b[1] - a[1]);
    if (entries[0][0] === req.userId) await awardXp(req.userId, 40, 'duel_win');
    await awardXp(req.userId, 15, 'duel_play');
  }
  res.json({ correct, total: d.questions.length, scores: d.scores, status: d.status });
});

router.get('/boss', authMiddleware, async (req, res) => {
  try {
    const wk = weekKey();
    const bossList = await readDB('arena_boss_cache');
    let cache = bossList.find((b) => b.week === wk);
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
      const all = await readDB('arena_boss_cache');
      all.push(cache);
      await writeDB('arena_boss_cache', all);
    }
    const attempts = await findAll('arena_boss_attempts', (a) => a.userId === req.userId && a.week === wk);
    res.json({ boss: cache, myAttempts: attempts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/boss/submit', authMiddleware, async (req, res) => {
  const { answers } = req.body;
  const wk = weekKey();
  const bossList = await readDB('arena_boss_cache');
  const cache = bossList.find((b) => b.week === wk);
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
  const all = await readDB('arena_boss_attempts');
  all.push(row);
  await writeDB('arena_boss_attempts', all);
  await awardXp(req.userId, Math.max(20, correct * 5), 'boss');
  res.json({ score: correct, total: cache.questions.length });
});

router.post('/squad/create', authMiddleware, async (req, res) => {
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
  const all = await readDB('arena_squads');
  all.push(squad);
  await writeDB('arena_squads', all);
  res.json({ squad });
});

router.post('/squad/join', authMiddleware, async (req, res) => {
  const { invite } = req.body;
  const all = await readDB('arena_squads');
  const idx = all.findIndex((s) => s.invite === String(invite).toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Invalid invite' });
  const s = all[idx];
  if ((s.memberIds || []).includes(req.userId)) return res.json({ squad: s });
  if ((s.memberIds || []).length >= 5) return res.status(400).json({ error: 'Squad full' });
  s.memberIds.push(req.userId);
  await writeDB('arena_squads', all);
  res.json({ squad: s });
});

router.post('/squad/:id/progress', authMiddleware, async (req, res) => {
  const { delta } = req.body;
  const all = await readDB('arena_squads');
  const idx = all.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const s = all[idx];
  if (!(s.memberIds || []).includes(req.userId)) return res.status(403).json({ error: 'Not a member' });
  s.challengeProgress = Math.min(s.challengeTarget || 50, (s.challengeProgress || 0) + (Number(delta) || 1));
  await writeDB('arena_squads', all);
  if (s.challengeProgress >= (s.challengeTarget || 50)) await awardXp(req.userId, 30, 'squad_week');
  res.json({ squad: s });
});

router.get('/leaderboard', authMiddleware, async (req, res) => {
  res.json({ leaderboard: await listLeaderboard(30) });
});

export default router;
