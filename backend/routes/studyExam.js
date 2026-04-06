import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { readDB, writeDB, findAll } from '../middleware/db.js';
import { callGeminiJSON } from '../services/gemini.js';
import { awardXp } from '../services/gamificationCore.js';

const router = express.Router();

function normalizeMcq(q) {
  const options = Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['A', 'B', 'C', 'D'];
  const answer = q.answer || options[0];
  return {
    id: q.id || uuidv4(),
    question: q.question || '',
    type: 'mcq',
    options,
    answer: String(answer),
    topic: q.topic || 'general',
  };
}

function fallbackQuestion(subject, topic = 'general') {
  const topicLabel = topic || 'general concepts';
  return normalizeMcq({
    id: uuidv4(),
    question: `(${subject}) Which statement best describes ${topicLabel}?`,
    options: [
      `${topicLabel} should be practiced with examples and spaced revision.`,
      `${topicLabel} can only be learned by memorizing definitions once.`,
      `${topicLabel} should be ignored if a chapter feels difficult.`,
      `${topicLabel} cannot be improved through feedback and quizzes.`,
    ],
    answer: `${topicLabel} should be practiced with examples and spaced revision.`,
    topic,
  });
}

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

/** POST /api/study/exam/start */
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { subject, examDate } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject required' });
    const system = `You are an exam author. Output ONLY JSON: {"question":"...","options":["",""],"answer":"exact option text","topic":"short tag"}`;
    const user = `Subject: ${subject}. Exam date: ${examDate || 'soon'}. Create one challenging MCQ (4 options).`;
    let q;
    try {
      const raw = await callGeminiJSON(system, user, 1024);
      q = normalizeMcq(typeof raw === 'object' && raw && !Array.isArray(raw) ? raw : {});
    } catch {
      q = fallbackQuestion(subject);
    }
    const session = {
      id: uuidv4(),
      userId: req.userId,
      subject,
      examDate: examDate || null,
      weakTopics: [],
      questions: [q],
      answers: [],
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const all = await readDB('exam_adaptive_sessions');
    all.push(session);
    await writeDB('exam_adaptive_sessions', all);
    res.json({ sessionId: session.id, question: q });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Start failed' });
  }
});

/** POST /api/study/exam/answer */
router.post('/answer', authMiddleware, async (req, res) => {
  try {
    const { sessionId, questionId, selectedOption } = req.body;
    if (!sessionId || !questionId) return res.status(400).json({ error: 'sessionId and questionId required' });
    const all = await readDB('exam_adaptive_sessions');
    const idx = all.findIndex((s) => s.id === sessionId && s.userId === req.userId);
    if (idx === -1) return res.status(404).json({ error: 'Session not found' });
    const session = all[idx];
    const q = session.questions.find((x) => x.id === questionId);
    if (!q) return res.status(400).json({ error: 'Unknown question' });
    const correct = String(selectedOption).trim() === String(q.answer).trim();
    if (!correct && q.topic) session.weakTopics.push(q.topic);
    else if (!correct) session.weakTopics.push('general');
    session.answers.push({ questionId, selectedOption, correct, topic: q.topic || 'general' });

    const weak = [...new Set(session.weakTopics)].slice(-8);
    const system = `You are an exam author. Output ONLY JSON: {"question":"...","options":["","","",""],"answer":"exact option text","topic":"short weak-area tag"}`;
    const user = `Subject: ${session.subject}. Previous weak topics: ${weak.join(', ')}. Write one follow-up MCQ targeting a weak area.`;
    let nextQ;
    try {
      const raw = await callGeminiJSON(system, user, 1200);
      nextQ = normalizeMcq(typeof raw === 'object' && raw && !Array.isArray(raw) ? raw : {});
    } catch {
      nextQ = fallbackQuestion(session.subject, weak[0] || 'general');
    }
    session.questions.push(nextQ);
    all[idx] = session;
    await writeDB('exam_adaptive_sessions', all);

    res.json({ correct, weakTopics: weak, nextQuestion: nextQ });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Answer failed' });
  }
});

/** POST /api/study/exam/finish */
router.post('/finish', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const all = await readDB('exam_adaptive_sessions');
    const idx = all.findIndex((s) => s.id === sessionId && s.userId === req.userId);
    if (idx === -1) return res.status(404).json({ error: 'Session not found' });
    const session = all[idx];
    const wrong = session.answers.filter((a) => !a.correct);
    const weakFreq = {};
    for (const a of wrong) {
      const t = a.topic || 'general';
      weakFreq[t] = (weakFreq[t] || 0) + 1;
    }
    const system = `Output ONLY JSON: {"weakness_map":[{"topic":"string","severity":1,"hint":"string"}],"revision_plan":[{"day":1,"tasks":["string"]}] }
severity 1-5. revision_plan exactly 3 days.`;
    const user = `Subject ${session.subject}. Weak frequency: ${JSON.stringify(weakFreq)}. Create a 3-day revision plan.`;
    let plan;
    try {
      plan = await callGeminiJSON(system, user, 2048);
    } catch {
      plan = fallbackRevisionPlan(weakFreq);
    }
    session.status = 'completed';
    session.finishedAt = new Date().toISOString();
    session.result = plan;
    all[idx] = session;
    await writeDB('exam_adaptive_sessions', all);

    const correctN = session.answers.filter((a) => a.correct).length;
    const total = session.answers.length;
    const pct = total ? Math.round((correctN / total) * 100) : 0;
    await awardXp(req.userId, Math.max(15, pct), 'adaptive_exam');

    res.json({ weakness_map: plan.weakness_map || [], revision_plan: plan.revision_plan || [], score: { correct: correctN, total } });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Finish failed' });
  }
});

/** GET /api/study/exam/sessions — recent */
router.get('/sessions', authMiddleware, async (req, res) => {
  const list = await findAll('exam_adaptive_sessions', (s) => s.userId === req.userId);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ sessions: list.slice(0, 20) });
});

export default router;
