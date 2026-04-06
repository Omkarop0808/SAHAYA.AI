import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { readDB, writeDB, findAll } from '../middleware/db.js';
import { callGemini } from '../services/gemini.js';

const router = express.Router();
const IDLE_MS = 4 * 60 * 1000;

router.post('/ping', authMiddleware, async (req, res) => {
  const path = (req.body.path || '').slice(0, 200);
  const all = await readDB('study_coach_activity');
  const idx = all.findIndex((r) => r.userId === req.userId);
  const row = {
    userId: req.userId,
    lastPath: path,
    lastActiveAt: Date.now(),
    updatedAt: new Date().toISOString(),
  };
  if (idx === -1) all.push(row);
  else all[idx] = { ...all[idx], ...row };
  await writeDB('study_coach_activity', all);
  res.json({ ok: true });
});

router.get('/nudge', authMiddleware, async (req, res) => {
  try {
    const all = await readDB('study_coach_activity');
    const row = all.find((r) => r.userId === req.userId);
    const now = Date.now();
    const force = req.query.force === '1';
    if (!force && row && now - row.lastActiveAt < IDLE_MS) {
      return res.json({ nudge: null, idleMs: row ? now - row.lastActiveAt : 0 });
    }

    const attempts = (await findAll('quiz_attempts', (r) => r.userId === req.userId)).slice(0, 3);
    const weakHint = attempts.map((a) => `${a.subject}:${a.score}%`).join(', ') || 'general study';

    const system = 'You are a supportive study coach. One short message (max 2 sentences). No guilt-tripping.';
    const user = `Student idle or needs a nudge. Last page: ${row?.lastPath || 'unknown'}. Recent quiz hints: ${weakHint}. Give one actionable micro-task.`;
    const text = await callGemini(system, user, { maxTokens: 200 });
    res.json({ nudge: text.trim(), idleMs: row ? now - row.lastActiveAt : IDLE_MS });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Coach failed' });
  }
});

export default router;
