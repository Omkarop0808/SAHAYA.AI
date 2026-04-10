import express from 'express';
import { findAll, readDB, writeDB } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { awardXp, xpFromQuizScore } from '../services/gamificationCore.js';
import { applyQuizScoreToReadiness } from '../services/readinessCore.js';
import { callGeminiJSON } from '../services/gemini.js';

function fallbackRevisionPlan(weakFreq) {
  const weakTopics = Object.keys(weakFreq || {});
  const main = weakTopics[0] || 'core concepts';
  const secondary = weakTopics[1] || 'problem solving';
  return {
    weakness_map: weakTopics.map((t) => ({
      topic: t,
      severity: Math.min(5, Math.max(1, weakFreq[t] || 1)),
      hint: `Review ${t} using short notes, one worked example, then a timed quiz.`,
    })),
    revision_plan: [
      { day: 1, tasks: [`Revise ${main} notes`, `Solve 10 practice questions on ${main}`] },
      { day: 2, tasks: [`Practice mixed questions on ${secondary}`, 'Review mistakes and write correction notes'] },
      { day: 3, tasks: ['Attempt a timed mini mock test', 'Summarize weak areas and final revision checklist'] },
    ],
  };
}

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

// POST /api/quiz/analyze — Generates a weakness map and revision plan based on wrong answers
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const { subject, questions } = req.body;
    if (!subject || !questions) return res.status(400).json({ error: 'subject and questions required.' });

    const wrong = questions.filter((q) => q.userAnswer !== q.correctAnswer && q.correctAnswer !== (q.options ? q.options[['A','B','C','D'].indexOf(q.userAnswer)] : null));

    const weakFreq = {};
    for (const q of wrong) {
      const t = q.topic || 'general';
      weakFreq[t] = (weakFreq[t] || 0) + 1;
    }
    
    if (Object.keys(weakFreq).length === 0) {
      return res.json({ weakness_map: [], revision_plan: [] });
    }

    const system = `Output ONLY JSON: {"weakness_map":[{"topic":"string","severity":1,"hint":"string"}],"revision_plan":[{"day":1,"tasks":["string"]}] }
severity 1-5. revision_plan exactly 3 days.`;
    const user = `Subject ${subject}. Weak frequency: ${JSON.stringify(weakFreq)}. Create a 3-day revision plan.`;
    
    let plan;
    try {
      plan = await callGeminiJSON(system, user, 2048);
    } catch {
      plan = fallbackRevisionPlan(weakFreq);
    }

    res.json({ weakness_map: plan.weakness_map || [], revision_plan: plan.revision_plan || [] });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Analyze failed' });
  }
});

// GET /api/quiz/:subject — quiz history for one subject
router.get('/:subject', authMiddleware, async (req, res) => {
  const subject = decodeURIComponent(req.params.subject);
  const records = await findAll('quiz_attempts', (r) => r.userId === req.userId && r.subject === subject);
  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ attempts: records });
});

export default router;
