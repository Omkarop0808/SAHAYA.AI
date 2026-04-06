import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import examsRoutes from './routes/exams.js';
import growthRoutes from './routes/growth.js';
import timetableRoutes from './routes/timetable.js';
import subjectsRoutes from './routes/subjects.js';
import aiRoutes from './routes/ai.js';
import contactRoutes from './routes/contact.js';
import quizRoutes from './routes/quiz.js';
import sessionRoutes from './routes/session.js';
import aiPredictRoutes from './routes/aiPredict.js';
import studyHubRoutes from './routes/studyHub.js';
import studyGraphRoutes from './routes/studyGraph.js';
import studyCoachRoutes from './routes/studyCoach.js';
import studyExamRoutes from './routes/studyExam.js';
import studyGoalsRoutes from './routes/studyGoals.js';
import studyArenaRoutes from './routes/studyArena.js';
import studyGamificationRoutes from './routes/studyGamification.js';
import interviewLabRoutes from './routes/interviewLab.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowed = [process.env.FRONTEND_URL || 'http://localhost:5005', 'http://localhost:5173', 'http://localhost:5174'];
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(null, true); // allow all in dev
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/ai-predict', aiPredictRoutes);
app.use('/api/study/hub', studyHubRoutes);
app.use('/api/study/graph', studyGraphRoutes);
app.use('/api/study/coach', studyCoachRoutes);
app.use('/api/study/exam', studyExamRoutes);
app.use('/api/study/goals', studyGoalsRoutes);
app.use('/api/study/arena', studyArenaRoutes);
app.use('/api/study', studyGamificationRoutes);
app.use('/api/interview', interviewLabRoutes);

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 handler
app.use((_, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, _, res, __) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Intelligent Learning AI System (Study) Backend → http://localhost:${PORT}`);
  console.log(`📁 Data stored in: ./data/`);
  console.log(`⚡ Groq: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  console.log(`🔑 Gemini: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  console.log(`🤗 Hugging Face: ${process.env.HF_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  console.log(`📧 Mail: ${process.env.MAIL_USER ? '✅ Set' : '❌ Missing — add to .env'}\n`);
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error('Close the existing backend process or run on another port.');
    console.error('Windows quick fix: for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5006 ^| findstr LISTENING\') do taskkill /PID %a /F\n');
    process.exit(1);
  }
  throw err;
});
