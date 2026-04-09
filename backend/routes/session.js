import express from 'express';
import { findAll, readDB, writeDB } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/heartbeat', authMiddleware, async (req, res) => {
  const { activeSeconds = 60, isBreak = false } = req.body;
  const today = new Date().toISOString().split('T')[0];

  const all = await readDB('sessions');
  const idx = all.findIndex((r) => r.userId === req.userId && r.date === today);

  if (idx === -1) {
    all.push({
      userId: req.userId,
      date: today,
      totalOnlineMinutes: 1,
      activeMinutes: Math.round(activeSeconds / 60),
      breaks: isBreak ? 1 : 0,
      focusLevel: 10,
      updatedAt: new Date().toISOString(),
    });
  } else {
    const s = all[idx];
    s.totalOnlineMinutes = (s.totalOnlineMinutes || 0) + 1;
    s.activeMinutes = (s.activeMinutes || 0) + Math.round(activeSeconds / 60);
    if (isBreak) s.breaks = (s.breaks || 0) + 1;
    s.focusLevel =
      s.totalOnlineMinutes > 0
        ? Math.max(1, Math.round((s.activeMinutes / s.totalOnlineMinutes) * 10))
        : 5;
    s.updatedAt = new Date().toISOString();
    all[idx] = s;
  }

  await writeDB('sessions', all);
  res.json({ success: true });
});

router.get('/today', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const records = await findAll('sessions', (r) => r.userId === req.userId && r.date === today);
  const record = records[0];
  res.json({
    session: record || {
      date: today,
      totalOnlineMinutes: 0,
      activeMinutes: 0,
      breaks: 0,
      focusLevel: 5,
    },
  });
});

router.get('/recent', authMiddleware, async (req, res) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const records = (
    await findAll(
      'sessions',
      (r) => r.userId === req.userId && new Date(r.date) >= cutoff,
    )
  ).sort((a, b) => b.date.localeCompare(a.date));
  res.json({ sessions: records });
});

export default router;
