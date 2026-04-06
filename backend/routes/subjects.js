import express from 'express';
import { findAll, upsertOne } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/:subject', authMiddleware, async (req, res) => {
  const subject = decodeURIComponent(req.params.subject);
  const records = await findAll('subject_data', (r) => r.userId === req.userId && r.subject === subject);
  const record = records[0] || null;
  res.json({ subjectData: record || { subject, notes: '', youtubeLink: '', summary: '', questions: [] } });
});

router.post('/:subject', authMiddleware, async (req, res) => {
  const subject = decodeURIComponent(req.params.subject);
  const { notes, youtubeLink, summary, questions } = req.body;

  const existingRecords = await findAll('subject_data', (r) => r.userId === req.userId && r.subject === subject);
  const existing = existingRecords[0] || {};

  const doc = {
    userId: req.userId,
    subject,
    notes: notes !== undefined ? notes : existing.notes || '',
    youtubeLink: youtubeLink !== undefined ? youtubeLink : existing.youtubeLink || '',
    summary: summary !== undefined ? summary : existing.summary || '',
    questions: questions !== undefined ? questions : existing.questions || [],
    updatedAt: new Date().toISOString(),
  };
  await upsertOne('subject_data', (r) => r.userId === req.userId && r.subject === subject, doc);
  res.json({ success: true, subjectData: doc });
});

export default router;
