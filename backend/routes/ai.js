import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { callGemini, callGeminiJSON } from '../services/gemini.js';

const router = express.Router();

// POST /api/ai/questions
router.post('/questions', authMiddleware, async (req, res) => {
  const { subject, context, count = 5 } = req.body;
  if (!subject) return res.status(400).json({ error: 'subject is required.' });
  try {
    const system = `You are an expert educator. Generate clear, well-structured practice questions.
Return ONLY a JSON array of question objects with fields: "question", "type" (mcq/short/long), "options" (array of 4 for mcq, null otherwise), "answer".`;
    const prompt = `Subject: ${subject}\nContext: ${context || 'General concepts'}\nGenerate ${count} practice questions of mixed types.`;
    const parsed = await callGeminiJSON(system, prompt, 2048);
    const questions = Array.isArray(parsed) ? parsed : parsed?.questions || [];
    res.json({ questions: Array.isArray(questions) ? questions : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/summarize
router.post('/summarize', authMiddleware, async (req, res) => {
  const { subject, text } = req.body;
  if (!subject || !text) return res.status(400).json({ error: 'subject and text are required.' });
  try {
    const system = `You are a study assistant. Summarize study material clearly and concisely with key points, important definitions, and main concepts. Use structured formatting with bullet points and sections.`;
    const prompt = `Subject: ${subject}\n\nNotes:\n${text}\n\nProvide a comprehensive summary.`;
    const summary = await callGemini(system, prompt, { maxTokens: 1500 });
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/schedule
router.post('/schedule', authMiddleware, async (req, res) => {
  const { subjects, examDates, hoursPerDay } = req.body;
  if (!subjects?.length) return res.status(400).json({ error: 'subjects are required.' });
  try {
    const system = `You are a study planner. Create a realistic, personalized study schedule. Return a JSON object with a "schedule" array. Each item: { "date": "YYYY-MM-DD", "subject": "...", "topic": "...", "duration": "X hours", "priority": "high/medium/low" }`;
    const prompt = `Subjects: ${subjects.join(', ')}\nExam dates: ${JSON.stringify(examDates || [])}\nAvailable hours per day: ${hoursPerDay || 3}\nCreate a 2-week study schedule starting from today.`;
    const result = await callGeminiJSON(system, prompt, 3000);
    const schedule = result?.schedule || [];
    res.json({ schedule: Array.isArray(schedule) ? schedule : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/ask
router.post('/ask', authMiddleware, async (req, res) => {
  const { question, subject, eduContext } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required.' });
  try {
    const system = `You are Intelligent Learning AI System (study assistant). Answer clearly and helpfully. Use examples where helpful.\nStudent context: ${JSON.stringify(eduContext || {})}`;
    const prompt = `Subject: ${subject || 'General'}\nQuestion: ${question}`;
    const answer = await callGemini(system, prompt, { maxTokens: 1200 });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/materials
router.post('/materials', authMiddleware, async (req, res) => {
  const { subject, level, weakAreas } = req.body;
  if (!subject) return res.status(400).json({ error: 'subject is required.' });
  try {
    const system = `You are a study resource expert. Provide 6-8 materials. Return ONLY JSON: { "materials": [{ "type": "video"|"website"|"practice", "title": "", "description": "", "url": "" }] }`;
    const prompt = `Subject: ${subject}\nLevel: ${level || 'general'}\nWeak areas: ${weakAreas || 'general'}`;
    const result = await callGeminiJSON(system, prompt, 1200);
    res.json({ materials: Array.isArray(result?.materials) ? result.materials : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/growth
router.post('/growth', authMiddleware, async (req, res) => {
  const { subject, scores, topics } = req.body;
  if (!subject) return res.status(400).json({ error: 'subject is required.' });
  try {
    const system = `You are a learning analyst. Return JSON: { "strengths": [], "weaknesses": [], "suggestions": [], "overallScore": 0-100, "trend": "improving/declining/stable" }`;
    const prompt = `Subject: ${subject}\nQuiz scores: ${JSON.stringify(scores || [])}\nTopics: ${(topics || []).join(', ')}`;
    const result = await callGeminiJSON(system, prompt, 800);
    res.json(result || { strengths: [], weaknesses: [], suggestions: [], overallScore: 70, trend: 'stable' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
