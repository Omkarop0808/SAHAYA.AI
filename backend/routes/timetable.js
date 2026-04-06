import express from 'express';
import { findAll, upsertOne } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const records = await findAll('timetable', (r) => r.userId === req.userId);
  const record = records[0] || null;
  res.json({ timetable: record });
});

router.post('/', authMiddleware, async (req, res) => {
  const { hoursPerDay, schedule } = req.body;
  if (hoursPerDay == null) return res.status(400).json({ error: 'hoursPerDay is required.' });

  const doc = {
    userId: req.userId,
    hoursPerDay,
    schedule: Array.isArray(schedule) ? schedule : [],
    updatedAt: new Date().toISOString(),
  };
  await upsertOne('timetable', (r) => r.userId === req.userId, doc);
  res.json({ success: true, timetable: doc });
});

export default router;
