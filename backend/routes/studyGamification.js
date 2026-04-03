import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getOrCreateGamification } from '../services/gamificationCore.js';

const router = express.Router();

/** GET /api/study/xp */
router.get('/xp', authMiddleware, (req, res) => {
  const row = getOrCreateGamification(req.userId);
  res.json(row);
});

export default router;
