# SAHAYA.AI — Intelligent Learning AI System

SAHAYA.AI is an AI-powered learning platform built for students to study smarter with adaptive quizzes, smart content upload, personalized planning, and progress analytics.

## Tech Stack

- Frontend: React 18, Vite, Tailwind CSS, Framer Motion
- Backend: Node.js, Express, JWT auth
- AI Providers: Groq, Gemini, Hugging Face fallback
- ML: Python + scikit-learn model for performance prediction
- Data Store (current): JSON file-based local storage

## Core Features

- Smart Upload Hub: upload PDF/text/URL/YouTube input and generate summaries, flashcards, question bank, roadmap
- Adaptive Exam Simulator: dynamic follow-up questions and weakness-based 3-day revision plan
- Living Knowledge Graph: concept nodes + relationships generated from uploaded content
- Study Coach: context-aware nudges based on activity
- Quiz + Growth Tracking: score history, XP, and AI-driven insights
- AI Timetable Prediction: ML-backed recommended study hours and per-subject allocation

## Project Structure

- frontend: React app
- backend: Express API + Python ML service files

## Local Development

### 1) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend default URL: http://localhost:5006

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend default URL: http://localhost:5005

## Environment Variables

Required (backend):

- JWT_SECRET
- At least one AI provider key:
	- GROQ_API_KEY (recommended)
	- GEMINI_API_KEY
	- HF_API_KEY

Optional:

- MAIL_USER / MAIL_PASS for contact form delivery
- PYTHON_BIN for custom Python path used by /api/ai-predict

## Production Readiness Notes

- Sensitive files are excluded via root `.gitignore` (`.env`, local data files, logs, caches)
- Do not commit backend/data JSON files from local/dev environments
- Rotate API keys before production deployment if they were ever exposed locally
- Prefer managed DB (e.g. Supabase/Postgres) over JSON storage for production

## Scripts

Backend:

- `npm run dev` — start API with nodemon
- `npm run start` — start API in production mode

Frontend:

- `npm run dev` — start Vite dev server
- `npm run build` — production build

## License

This project is currently maintained as a personal/portfolio project.
