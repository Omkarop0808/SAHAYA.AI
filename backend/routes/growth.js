import express from 'express';
import { findAll, upsertOne } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const records = await findAll('growth', (r) => r.userId === req.userId);
  res.json({ growth: records });
});

router.get('/:subject', authMiddleware, async (req, res) => {
  const subject = decodeURIComponent(req.params.subject);
  const records = await findAll('growth', (r) => r.userId === req.userId && r.subject === subject);
  const record = records[0] || null;
  res.json({ growth: record || null });
});

router.post('/', authMiddleware, async (req, res) => {
  const { subject, scores, analysis } = req.body;
  if (!subject) return res.status(400).json({ error: 'subject is required.' });

  const doc = {
    userId: req.userId,
    subject,
    scores: scores || [],
    analysis: analysis || null,
    updatedAt: new Date().toISOString(),
  };
  await upsertOne('growth', (r) => r.userId === req.userId && r.subject === subject, doc);
  res.json({ success: true, growth: doc });
});

export default router;
