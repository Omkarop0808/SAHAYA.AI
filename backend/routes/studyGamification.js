import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getOrCreateGamification } from '../services/gamificationCore.js';

const router = express.Router();

/** GET /api/study/xp */
router.get('/xp', authMiddleware, async (req, res) => {
  const row = await getOrCreateGamification(req.userId);
  res.json(row);
});

export default router;
