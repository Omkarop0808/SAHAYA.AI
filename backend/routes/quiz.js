import express from 'express';
import { findAll, readDB, writeDB } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { awardXp, xpFromQuizScore } from '../services/gamificationCore.js';
import { applyQuizScoreToReadiness } from '../services/readinessCore.js';

const router = express.Router();

// GET /api/quiz — all quiz attempts for user (all subjects)
router.get('/', authMiddleware, async (req, res) => {
  const records = await findAll('quiz_attempts', (r) => r.userId === req.userId);
  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ attempts: records });
});

// GET /api/quiz/summary/all — must be before /:subject
router.get('/summary/all', authMiddleware, async (req, res) => {
  const attempts = await findAll('quiz_attempts', (r) => r.userId === req.userId);

  const bySubject = {};
  for (const a of attempts) {
    if (!bySubject[a.subject] || new Date(a.createdAt) > new Date(bySubject[a.subject].createdAt)) {
      bySubject[a.subject] = a;
    }
  }

  const summary = Object.values(bySubject).map((a) => ({
    name: a.subject,
    correct_questions: a.correct,
    total_questions: a.total,
    latest_score: a.score,
    difficulty: a.difficulty,
    previous_score: a.previousScore,
  }));

  res.json({ summary });
});

// POST /api/quiz/save
router.post('/save', authMiddleware, async (req, res) => {
  const { subject, correct, total, questions, timeTakenSeconds } = req.body;
  if (!subject || total == null) return res.status(400).json({ error: 'subject and total are required.' });

  const accuracy = total > 0 ? correct / total : 0;
  const score = Math.round(accuracy * 100);
  const difficulty = Math.max(1, Math.min(5, 5 - accuracy * 4));

  const now = new Date().toISOString();

  const existing = await findAll('quiz_attempts', (r) => r.userId === req.userId && r.subject === subject);
  existing.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const previousScore = existing.length > 0 ? existing[0].score : score;

  const attempt = {
    id: `${req.userId}_${subject}_${Date.now()}`,
    userId: req.userId,
    subject,
    correct: correct || 0,
    total,
    score,
    accuracy: Math.round(accuracy * 100) / 100,
    difficulty: Math.round(difficulty * 100) / 100,
    previousScore,
    timeTakenSeconds: timeTakenSeconds || 0,
    questions: questions || [],
    createdAt: now,
    date: now.split('T')[0],
    time: now.split('T')[1].slice(0, 5),
  };

  const all = await readDB('quiz_attempts');
  all.push(attempt);
  await writeDB('quiz_attempts', all);

  const xpGain = xpFromQuizScore(score, total);
  await awardXp(req.userId, xpGain, 'quiz_complete');
  await applyQuizScoreToReadiness(req.userId, subject, score, total);

  res.json({ success: true, attempt, xpGained: xpGain });
});

// GET /api/quiz/:subject — quiz history for one subject
router.get('/:subject', authMiddleware, async (req, res) => {
  const subject = decodeURIComponent(req.params.subject);
  const records = await findAll('quiz_attempts', (r) => r.userId === req.userId && r.subject === subject);
  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ attempts: records });
});

export default router;
