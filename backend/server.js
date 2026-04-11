import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';


// Ensure .env is loaded from the backend folder even when server
// is started via "node backend/server.js" from the monorepo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

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
import skillscanRoutes from './routes/skillscan.js';
import careerRoadmapRoutes from './career-roadmap/routes.js';
import interviewLabRoutes from './routes/interviewLab.js';
import gamificationRoutes from './routes/gamification.js';
import socraticRoutes from './routes/socratic.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5005',
  'http://192.168.7.156:5005'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
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
app.use('/api/study/companion', studyCompanionRoutes);
app.use('/api/study/coach', studyCoachRoutes);
app.use('/api/study/exam', studyExamRoutes);
app.use('/api/study/goals', studyGoalsRoutes);
app.use('/api/study/arena', studyArenaRoutes);
app.use('/api/study', studyGamificationRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/career/skillscan', skillscanRoutes);
app.use('/api/career/socratic', socraticRoutes);
app.use('/api/roadmap', careerRoadmapRoutes);
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

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5005',
    credentials: true,
  }
});

let gdLobby = [];
let gdReadyRooms = {}; // { roomId: { participants: [], readyCount: 0, readyUsers: [] } }

io.on('connection', (socket) => {
  socket.on('join_gd_lobby', (data) => {
    const existing = gdLobby.findIndex(u => u.socketId === socket.id);
    if (existing !== -1) gdLobby.splice(existing, 1);

    gdLobby.push({ socketId: socket.id, ...data });
    
    if (data.requestedSize > 1) {
       socket.broadcast.emit('gd_lobby_notification', {
          message: `${data.name || 'Student'} is starting a ${data.requestedSize}-person GD on ${data.topic || 'General Tech'}. Join now!`,
          inviteTopic: data.topic,
          inviteSize: data.requestedSize
       });
    }

    const getWaitlist = () => gdLobby.map(u => ({ name: u.name, topic: u.topic, requestedSize: u.requestedSize }));
    io.emit('lobby_update', getWaitlist());

    const compatibleUsers = gdLobby.filter(u => u.requestedSize === data.requestedSize && u.topic === data.topic);

    if (compatibleUsers.length >= data.requestedSize) {
       const roomParticipants = compatibleUsers.slice(0, data.requestedSize);
       const roomId = `gd_room_${Date.now()}`;
       
       gdLobby = gdLobby.filter(u => !roomParticipants.includes(u));

       // Initialize the Ready Room pending state
       gdReadyRooms[roomId] = {
           participants: roomParticipants,
           readyCount: 0,
           readyUsers: []
       };

       // Generate a specific thought-provoking GD Topic for this room
       const IT_TOPICS = [
         "Will Artificial Intelligence replace Junior Software Engineers?", 
         "Hybrid Work vs Full Return to Office in the Tech Industry", 
         "Is a formal CS Degree still strictly necessary in 2026?", 
         "The impact of Open Source on corporate software monopolies", 
         "Ethics in AI: Who is responsible when AI makes a mistake?", 
         "Agile vs Waterfall in modern hyper-growth startup culture", 
         "Can Web3 actually solve real-world problems?"
       ];
       const actualTopic = IT_TOPICS[Math.floor(Math.random() * IT_TOPICS.length)];

       roomParticipants.forEach(p => {
          io.to(p.socketId).emit('gd_match_found', { roomId, participants: roomParticipants, actualTopic });
       });
       io.emit('lobby_update', getWaitlist());
    }
  });

  socket.on('gd_player_ready', ({ roomId }) => {
     const room = gdReadyRooms[roomId];
     if (!room) return;

     if (!room.readyUsers.includes(socket.id)) {
         room.readyUsers.push(socket.id);
         room.readyCount += 1;

         // Broadcast the update to all matched participants in this pending room
         room.participants.forEach(p => {
             io.to(p.socketId).emit('gd_ready_update', room.readyCount);
         });

         // If everyone is ready, transition them!
         if (room.readyCount >= room.participants.length) {
             room.participants.forEach(p => {
                 io.to(p.socketId).emit('gd_start_room', { roomId });
             });
             delete gdReadyRooms[roomId];
         }
     }
  });

  socket.on('join_gd_room', ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on('gd_end_session', ({ roomId }) => {
    // Broadcast to everyone ELSE in the room that the session has ended
    socket.to(roomId).emit('gd_session_ended_broadcast');
  });

  socket.on('disconnect', () => {
    // Check if they were in a pending ready room
    for (const [roomId, room] of Object.entries(gdReadyRooms)) {
        if (room.participants.some(p => p.socketId === socket.id)) {
            // Cancel the room
            const survivingParticipants = room.participants.filter(p => p.socketId !== socket.id);
            survivingParticipants.forEach(p => {
                io.to(p.socketId).emit('gd_match_cancelled');
                // Auto requeue survivors back into lobby
                gdLobby.push({ socketId: p.socketId, name: p.name, requestedSize: p.requestedSize, topic: p.topic });
            });
            delete gdReadyRooms[roomId];
        }
    }

    gdLobby = gdLobby.filter(user => user.socketId !== socket.id);
    const currentWaitlist = gdLobby.map(u => ({ name: u.name, topic: u.topic, requestedSize: u.requestedSize }));
    io.emit('lobby_update', currentWaitlist);
  });

  socket.on('leave_gd_lobby', () => {
    gdLobby = gdLobby.filter(user => user.socketId !== socket.id);
    const currentWaitlist = gdLobby.map(u => ({ name: u.name, topic: u.topic, requestedSize: u.requestedSize }));
    io.emit('lobby_update', currentWaitlist);
  });
});

const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Intelligent Learning AI System (Study) Backend → http://0.0.0.0:${PORT}`);
  console.log(`📁 Data stored in: ./data/`);
  console.log(`⚡ Groq: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  console.log(`🔑 Gemini: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  console.log(`🤗 Hugging Face: ${process.env.HF_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  console.log(`🧠 Claude (optional): ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`🌐 Tavily: ${process.env.TAVILY_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  console.log(`🔊 ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  console.log(`📺 YouTube: ${process.env.YOUTUBE_API_KEY ? '✅ Set' : '❌ Missing (optional)'}`);
  const supa = process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY);
  console.log(`🗄️ Supabase: ${supa ? '✅ Enabled (app_data_rows)' : '❌ Not set — using backend/data/*.json'}`);
  console.log(`📧 Mail: ${process.env.MAIL_USER ? '✅ Set' : '❌ Missing — add to .env'}\n`);
  const requiredAiKeysLoaded = Boolean(process.env.GROQ_API_KEY && process.env.GEMINI_API_KEY && process.env.TAVILY_API_KEY);
  console.log(`🔐 Required AI keys (GROQ/GEMINI/TAVILY): ${requiredAiKeysLoaded ? '✅ Loaded' : '❌ Missing one or more'}\n`);
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
