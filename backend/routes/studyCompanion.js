import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { readDB, writeDB, findAll, insertOne } from '../middleware/db.js';
import {
  callGemini,
  callGeminiJSON,
  callDeepReason,
  callDeepReasonJSON,
  embedTextMiniLM,
  cosineSimilarity,
} from '../services/gemini.js';
import { awardXp } from '../services/gamificationCore.js';
import {
  applyAdaptiveSessionToReadiness,
  applyQuizScoreToReadiness,
  getReadinessSummary,
} from '../services/readinessCore.js';
import { addSrsCard, getDueCards, reviewSrsCard } from '../services/srsCore.js';

const router = express.Router();

const ADAPTIVE_SCHEMA = `Output ONLY valid JSON: {"question":"string","options":["four strings"],"correctIndex":0,"concept_label":"short string"}`;

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

function difficultyWord(d) {
  if (d <= 1) return 'very easy introductory';
  if (d === 2) return 'easy';
  if (d === 3) return 'intermediate';
  if (d === 4) return 'hard';
  return 'very challenging exam-level';
}

async function generateAdaptiveMCQ(subject, difficulty, context) {
  const sys = 'You write clear multiple-choice questions for university students. ' + ADAPTIVE_SCHEMA;
  const user = `Subject: ${subject}\nDifficulty: ${difficultyWord(difficulty)} (scale 1-5, current=${difficulty})\nContext (notes excerpt, may be short):\n${(context || '').slice(0, 12_000)}`;
  const q = await callGeminiJSON(sys, user, 2048);
  const options = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
  while (options.length < 4) options.push(`Option ${options.length + 1}`);
  let correctIndex = Number(q.correctIndex);
  if (Number.isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = 0;
  return {
    question: q.question || 'Question',
    options,
    correctIndex,
    concept_label: q.concept_label || subject,
    difficulty,
  };
}

async function loadSession(sessionId, userId) {
  const all = await readDB('adaptive_quiz_sessions');
  const s = all.find((x) => x.id === sessionId && x.userId === userId);
  return s || null;
}

async function saveSession(session) {
  const all = await readDB('adaptive_quiz_sessions');
  const idx = all.findIndex((x) => x.id === session.id);
  if (idx === -1) all.push(session);
  else all[idx] = session;
  await writeDB('adaptive_quiz_sessions', all);
}

async function collectWeakSignals(userId) {
  const attempts = await findAll('quiz_attempts', (r) => r.userId === userId);
  attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const lines = [];
  for (const a of attempts.slice(0, 20)) {
    for (const q of a.questions || []) {
      const ua = q.userAnswer;
      const ca = q.correctAnswer;
      if (ua == null || String(ua).trim() === '') continue;
      if (String(ua).trim() === String(ca).trim()) continue;
      lines.push(`${a.subject}: ${q.question}`);
    }
  }
  return lines.slice(0, 35);
}

router.get('/readiness', authMiddleware, async (req, res) => {
  res.json(await getReadinessSummary(req.userId));
});

router.get('/daily-plan/today', authMiddleware, async (req, res) => {
  const d = todayUTC();
  const plans = await readDB('study_daily_plans');
  const plan = plans.find((p) => p.userId === req.userId && p.date === d) || null;
  res.json({ plan });
});

router.post('/daily-plan/generate', authMiddleware, async (req, res) => {
  try {
    const minutesAvailable = Math.min(600, Math.max(30, Number(req.body.minutesAvailable) || 150));
    const examRows = await findAll('exams', (r) => r.userId === req.userId);
    const exams = examRows[0]?.exams || [];
    const attempts = await findAll('quiz_attempts', (r) => r.userId === req.userId);
    attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recent = attempts.slice(0, 8).map((a) => ({
      subject: a.subject,
      score: a.score,
      date: a.date,
    }));
    const duePreview = (await getDueCards(req.userId, 8)).map((c) => ({ front: c.front, subject: c.subject }));
    const readiness = await getReadinessSummary(req.userId);

    const sys = `You are a study coach. Output ONLY valid JSON:
{"title":"string","tasks":[{"id":"short_slug","title":"string","minutes":15,"type":"quiz|review|read|practice|exam_prep","subject":"string","detail":"one sentence what to do"}]}
Rules: 4-8 tasks; sum of minutes should be close to ${minutesAvailable} (within 15%); tasks must be concrete (e.g. "Redo 10 MCQs on X", not "study harder"); include at least one spaced-repetition review if flashcards listed; reference upcoming exams when relevant.`;

    const user = JSON.stringify({
      minutesAvailable,
      exams,
      recentQuizAttempts: recent,
      flashcardsDue: duePreview,
      readinessSummary: readiness,
    });

    const parsed = await callGeminiJSON(sys, user, 4096);
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const plan = {
      id: uuidv4(),
      userId: req.userId,
      date: todayUTC(),
      title: parsed.title || 'Today’s study plan',
      tasks: tasks.map((t, i) => ({
        id: t.id || `task_${i}`,
        title: t.title || 'Study block',
        minutes: Math.max(5, Math.min(120, Number(t.minutes) || 20)),
        type: t.type || 'read',
        subject: t.subject || 'General',
        detail: t.detail || '',
        done: false,
      })),
      generatedAt: new Date().toISOString(),
    };

    const prev = await readDB('study_daily_plans');
    const plans = prev.filter((p) => !(p.userId === req.userId && p.date === plan.date));
    plans.push(plan);
    await writeDB('study_daily_plans', plans);

    await awardXp(req.userId, 5, 'daily_plan_generated');
    res.json({ plan });
  } catch (e) {
    console.error('daily-plan', e);
    res.status(500).json({ error: e.message || 'Plan generation failed' });
  }
});

router.post('/daily-plan/complete-task', authMiddleware, async (req, res) => {
  const { planId, taskId } = req.body;
  if (!planId || !taskId) return res.status(400).json({ error: 'planId and taskId required' });
  const plans = await readDB('study_daily_plans');
  const idx = plans.findIndex((p) => p.id === planId && p.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Plan not found' });
  const plan = { ...plans[idx] };
  const tIdx = plan.tasks.findIndex((t) => t.id === taskId);
  if (tIdx === -1) return res.status(404).json({ error: 'Task not found' });
  if (!plan.tasks[tIdx].done) {
    plan.tasks[tIdx] = { ...plan.tasks[tIdx], done: true, completedAt: new Date().toISOString() };
    await awardXp(req.userId, 12, 'daily_plan_task');
  }
  plans[idx] = plan;
  await writeDB('study_daily_plans', plans);
  res.json({ plan });
});

router.post('/explain', authMiddleware, async (req, res) => {
  try {
    const { question, subject } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: 'question required' });
    const sys = `You are a patient tutor. Output ONLY valid JSON:
{"analogy":"string","technical":"string","worked_example":"string (step by step)"}`;
    const user = `Subject context: ${subject || 'General'}\n\nQuestion:\n${question.trim().slice(0, 8000)}`;
    const parsed = await callGeminiJSON(sys, user, 4096);
    const note = {
      id: uuidv4(),
      userId: req.userId,
      subject: (subject || 'General').trim(),
      question: question.trim().slice(0, 4000),
      analogy: parsed.analogy || '',
      technical: parsed.technical || '',
      worked_example: parsed.worked_example || '',
      messages: [],
      createdAt: new Date().toISOString(),
    };
    const notes = await readDB('study_explainer_notes');
    notes.push(note);
    await writeDB('study_explainer_notes', notes);
    await awardXp(req.userId, 8, 'concept_explained');
    res.json({ note });
  } catch (e) {
    console.error('explain', e);
    res.status(500).json({ error: e.message || 'Explanation failed' });
  }
});

router.get('/explain/notes', authMiddleware, async (req, res) => {
  const notes = await findAll('study_explainer_notes', (n) => n.userId === req.userId);
  notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ notes: notes.slice(0, 100) });
});

router.post('/explain/:noteId/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });
    const notes = await readDB('study_explainer_notes');
    const idx = notes.findIndex((n) => n.id === req.params.noteId && n.userId === req.userId);
    if (idx === -1) return res.status(404).json({ error: 'Note not found' });
    const note = { ...notes[idx] };
    const history = (note.messages || [])
      .slice(-10)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    const reply = await callGemini(
      'You are a concise tutor. Answer in under 220 words. Use plain language.',
      `Original Q: ${note.question}\nSaved explanations summary: analogy + technical + example on file.\nPrior chat:\n${history}\nStudent follow-up: ${message.trim()}`,
      { maxTokens: 700 },
    );
    note.messages = [
      ...(note.messages || []),
      { role: 'user', content: message.trim(), at: new Date().toISOString() },
      { role: 'assistant', content: reply.trim(), at: new Date().toISOString() },
    ];
    notes[idx] = note;
    await writeDB('study_explainer_notes', notes);
    res.json({ reply: reply.trim(), note });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Chat failed' });
  }
});

router.post('/adaptive/start', authMiddleware, async (req, res) => {
  try {
    const subject = (req.body.subject || 'General').trim();
    const documentId = req.body.documentId || null;
    let context = '';
    if (documentId) {
      const docs = await findAll('study_documents', (d) => d.userId === req.userId && d.id === documentId);
      if (docs[0]) context = docs[0].textPreview || docs[0].outputs?.summary || '';
    }
    if (!context && req.body.context) context = String(req.body.context).slice(0, 20_000);

    const difficulty = 3;
    const mcq = await generateAdaptiveMCQ(subject, difficulty, context);

    const session = {
      id: uuidv4(),
      userId: req.userId,
      subject,
      contextSnippet: context.slice(0, 4000),
      difficulty,
      targetRounds: Math.min(12, Math.max(5, Number(req.body.rounds) || 8)),
      completedRounds: 0,
      correct: 0,
      history: [],
      currentQuestion: mcq,
      startedAt: new Date().toISOString(),
    };
    await saveSession(session);

    res.json({
      sessionId: session.id,
      question: {
        question: mcq.question,
        options: mcq.options,
        difficulty: mcq.difficulty,
      },
      progress: { answered: 0, total: session.targetRounds, currentQuestion: 1 },
    });
  } catch (e) {
    console.error('adaptive start', e);
    res.status(500).json({ error: e.message || 'Could not start session' });
  }
});

router.post('/adaptive/answer', authMiddleware, async (req, res) => {
  try {
    const { sessionId, selectedIndex } = req.body;
    const session = await loadSession(sessionId, req.userId);
    if (!session || !session.currentQuestion) {
      return res.status(400).json({ error: 'Invalid or finished session' });
    }

    const q = session.currentQuestion;
    const correct = Number(selectedIndex) === q.correctIndex;
    let explanation = '';
    let flashcard = null;

    if (!correct) {
      const sys = 'Explain why the right answer is correct using a different angle than a typical textbook. Under 180 words. No JSON.';
      const user = `Q: ${q.question}\nOptions: ${q.options.join(' | ')}\nCorrect index: ${q.correctIndex}\nStudent picked: ${selectedIndex}`;
      explanation = await callGemini(sys, user, { maxTokens: 400 });

      flashcard = await addSrsCard(
        req.userId,
        session.subject,
        q.concept_label || session.subject,
        `${q.question}\n\n→ ${q.options[q.correctIndex]}\n\n${explanation.slice(0, 1200)}`,
        'adaptive_quiz',
      );
    }

    session.history.push({
      question: q.question,
      correct,
      concept: q.concept_label,
      difficulty: q.difficulty,
    });
    session.completedRounds += 1;
    if (correct) session.correct += 1;

    let nextDifficulty = session.difficulty;
    if (correct) nextDifficulty = Math.min(5, nextDifficulty + 1);
    else nextDifficulty = Math.max(1, nextDifficulty - 1);
    session.difficulty = nextDifficulty;

    const done = session.completedRounds >= session.targetRounds;
    if (!done) {
      const nextQ = await generateAdaptiveMCQ(session.subject, nextDifficulty, session.contextSnippet);
      session.currentQuestion = nextQ;
    } else {
      session.currentQuestion = null;
      session.finishedAt = new Date().toISOString();
    }

    await saveSession(session);

    let sessionSummary = null;
    if (done && !session.finalized) {
      const total = session.completedRounds || 1;
      const acc = session.correct / total;
      await applyAdaptiveSessionToReadiness(req.userId, session.subject, acc);
      const score = Math.round(acc * 100);
      const attempt = {
        id: `${req.userId}_${session.subject}_ad_${Date.now()}`,
        userId: req.userId,
        subject: session.subject,
        correct: session.correct,
        total,
        score,
        accuracy: Math.round(acc * 100) / 100,
        difficulty: session.difficulty,
        previousScore: score,
        timeTakenSeconds: 0,
        questions: session.history.map((h) => ({
          question: h.question,
          type: 'adaptive_mcq',
          userAnswer: h.correct ? 'correct' : 'wrong',
          correctAnswer: 'adaptive',
        })),
        createdAt: new Date().toISOString(),
        date: todayUTC(),
        time: new Date().toISOString().split('T')[1].slice(0, 5),
        adaptive: true,
      };
      const qa = await readDB('quiz_attempts');
      qa.push(attempt);
      await writeDB('quiz_attempts', qa);
      const xpGain = Math.max(15, Math.min(180, Math.round(score / 5) + session.correct * 3));
      await awardXp(req.userId, xpGain, 'adaptive_quiz_complete');
      sessionSummary = { attempt, readiness: await getReadinessSummary(req.userId), xpGained: xpGain };
      session.finalized = true;
      session.summarySnapshot = sessionSummary;
      await saveSession(session);
    } else if (done && session.finalized) {
      sessionSummary = session.summarySnapshot || null;
    }

    res.json({
      correct,
      explanation: explanation || undefined,
      flashcardCreated: flashcard,
      progress: {
        answered: session.completedRounds,
        total: session.targetRounds,
        currentQuestion: done ? session.targetRounds : session.completedRounds + 1,
      },
      done,
      nextQuestion: !done
        ? {
            question: session.currentQuestion.question,
            options: session.currentQuestion.options,
            difficulty: session.currentQuestion.difficulty,
          }
        : null,
      sessionSummary,
    });
  } catch (e) {
    console.error('adaptive answer', e);
    res.status(500).json({ error: e.message || 'Failed to process answer' });
  }
});

router.post('/adaptive/finish', authMiddleware, async (req, res) => {
  const { sessionId } = req.body;
  const session = await loadSession(sessionId, req.userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.finalized && session.summarySnapshot) {
    return res.json(session.summarySnapshot);
  }
  res.status(400).json({ error: 'Session not complete yet — submit the last answer first.' });
});

router.post('/practice/generate', authMiddleware, async (req, res) => {
  try {
    const subject = (req.body.subject || 'General').trim();
    const weakLines = (await collectWeakSignals(req.userId)).filter(
      (l) => subject === 'General' || l.startsWith(`${subject}:`),
    );
    let focus = weakLines.slice(0, 5).join('\n');
    if (!focus) focus = `Core ideas in ${subject} that students often confuse.`;

    const anchorPhrase = req.body.focusTopic?.trim();
    if (anchorPhrase) {
      const anchorVec = await embedTextMiniLM(anchorPhrase);
      if (anchorVec) {
        const scored = [];
        for (const line of weakLines) {
          const v = await embedTextMiniLM(line);
          if (v) scored.push({ line, s: cosineSimilarity(anchorVec, v) });
        }
        scored.sort((a, b) => b.s - a.s);
        const ranked = scored.map((x) => x.line);
        if (ranked.length) focus = ranked.slice(0, 5).join('\n');
      }
    }

    const sys = `Create one practice problem for a university student. Output ONLY valid JSON:
{"prompt":"string","hints":["string"],"difficulty":1}`;
    const user = `Subject: ${subject}\nWeak areas / past mistakes (may be empty):\n${focus.slice(0, 6000)}`;
    const p = await callGeminiJSON(sys, user, 2048);
    const problem = {
      id: uuidv4(),
      userId: req.userId,
      subject,
      prompt: p.prompt || 'Solve a typical exam question in this subject.',
      hints: Array.isArray(p.hints) ? p.hints : [],
      difficulty: Number(p.difficulty) || 3,
      createdAt: new Date().toISOString(),
    };
    await insertOne('study_practice_problems', problem);
    res.json({ problem });
  } catch (e) {
    console.error('practice generate', e);
    res.status(500).json({ error: e.message || 'Could not generate problem' });
  }
});

router.post('/practice/evaluate', authMiddleware, async (req, res) => {
  try {
    const { problemId, answer, stuck } = req.body;
    if (!answer?.trim()) return res.status(400).json({ error: 'answer required' });
    const problems = await readDB('study_practice_problems');
    const prob = problems.find((p) => p.id === problemId && p.userId === req.userId);
    if (!prob) return res.status(404).json({ error: 'Problem not found' });

    if (stuck) {
      const fresh = await callDeepReason(
        'Re-explain the underlying idea from scratch using a totally different teaching approach (visual intuition, real-world workflow, or contrast with a common misconception). Under 320 words.',
        `Subject: ${prob.subject}\nProblem:\n${prob.prompt}\nStudent was stuck after trying:\n${answer.slice(0, 4000)}`,
        { maxTokens: 900 },
      );
      return res.json({ mode: 'remedial', explanation: fresh });
    }

    const raw = await callDeepReasonJSON(
      'You are a strict but kind grader. Evaluate the student solution. Be specific.',
      `Problem:\n${prob.prompt}\n\nStudent answer:\n${answer.slice(0, 12_000)}`,
      4096,
    );

    const scoreNum = Number(raw.score_0_100 ?? raw.score ?? 50);
    const attempt = {
      id: uuidv4(),
      userId: req.userId,
      problemId,
      answer: answer.slice(0, 20_000),
      score: scoreNum,
      feedback: raw,
      createdAt: new Date().toISOString(),
    };
    await insertOne('study_practice_attempts', attempt);

    if (scoreNum >= 75) {
      await awardXp(req.userId, 20, 'practice_strong');
    } else {
      await awardXp(req.userId, 8, 'practice_attempt');
    }

    await applyQuizScoreToReadiness(req.userId, prob.subject, scoreNum, 5);

    res.json({ evaluation: raw, xpHint: true });
  } catch (e) {
    console.error('practice eval', e);
    res.status(500).json({ error: e.message || 'Evaluation failed' });
  }
});

router.get('/srs/due', authMiddleware, async (req, res) => {
  res.json({ cards: await getDueCards(req.userId, 40) });
});

router.post('/srs/review', authMiddleware, async (req, res) => {
  const { cardId, quality } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });
  const card = await reviewSrsCard(cardId, req.userId, quality ?? 3);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  await awardXp(req.userId, 4, 'srs_review');
  res.json({ card });
});

export default router;
