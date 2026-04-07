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
import studyCompanionRoutes from './routes/studyCompanion.js';
import studyCoachRoutes from './routes/studyCoach.js';
import studyExamRoutes from './routes/studyExam.js';
import studyGoalsRoutes from './routes/studyGoals.js';
import studyArenaRoutes from './routes/studyArena.js';
import studyGamificationRoutes from './routes/studyGamification.js';
import careerRoutes from './routes/career.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5005',
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
app.use('/api/study/companion', studyCompanionRoutes);
app.use('/api/study/coach', studyCoachRoutes);
app.use('/api/study/exam', studyExamRoutes);
app.use('/api/study/goals', studyGoalsRoutes);
app.use('/api/study/arena', studyArenaRoutes);
app.use('/api/study', studyGamificationRoutes);
app.use('/api/career', careerRoutes);

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
  console.log(`🧠 Claude (optional): ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing'}`);
  const supa = process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY);
  console.log(`🗄️ Supabase: ${supa ? '✅ Enabled (app_data_rows)' : '❌ Not set — using backend/data/*.json'}`);
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
