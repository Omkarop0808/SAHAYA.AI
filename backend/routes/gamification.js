import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getOrCreateGamification, getOrCreateDailyQuests, claimQuest, listLeaderboard } from '../services/gamificationCore.js';

const router = express.Router();

/** GET /api/gamification/profile */
router.get('/profile', authMiddleware, async (req, res) => {
  const row = await getOrCreateGamification(req.userId);
  res.json(row);
});

/** GET /api/gamification/quests?world=study|career */
router.get('/quests', authMiddleware, async (req, res) => {
  const world = String(req.query.world || 'study');
  const quests = await getOrCreateDailyQuests(req.userId, world);
  res.json({ world, date: new Date().toISOString().split('T')[0], quests });
});

/** POST /api/gamification/quests/claim */
router.post('/quests/claim', authMiddleware, async (req, res) => {
  const { questId } = req.body;
  if (!questId) return res.status(400).json({ error: 'Missing questId' });
  const result = await claimQuest(req.userId, questId);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

/** GET /api/gamification/leaderboard */
router.get('/leaderboard', authMiddleware, async (req, res) => {
  const lb = await listLeaderboard(100);
  res.json({ leaderboard: lb });
});

export default router;
