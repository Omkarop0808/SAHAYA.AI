import express from 'express';
import { findAll, upsertOne } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const records = await findAll('exams', (r) => r.userId === req.userId);
  const record = records[0] || null;
  res.json({ exams: record?.exams || [] });
});

router.post('/', authMiddleware, async (req, res) => {
  const { exams } = req.body;
  if (!Array.isArray(exams)) return res.status(400).json({ error: 'exams must be an array.' });

  const doc = {
    userId: req.userId,
    exams,
    updatedAt: new Date().toISOString(),
  };
  await upsertOne('exams', (r) => r.userId === req.userId, doc);
  res.json({ success: true, exams });
});

export default router;
