# SAHAYA.AI — Intelligent Learning AI System

SAHAYA.AI is an AI-powered learning platform built for students to study smarter with adaptive quizzes, smart content upload, personalized planning, and progress analytics.

## Tech Stack

- Frontend: React 18, Vite, Tailwind CSS, Framer Motion
- Backend: Node.js, Express, JWT auth
- AI Providers: Groq, Gemini, Hugging Face fallback
- ML: Python + scikit-learn model for performance prediction
- Data Store: **Supabase** (Postgres + `app_data_rows`) when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise `backend/data/*.json` for local dev

## Core Features

- Study Studio: one-shot package from PDF/text/URL/YouTube — structured lesson, flashcards, quiz bank, practice problems with rubric, roadmap, videos
- Intelligent Study Companion: daily AI plan (time-boxed tasks), adaptive quiz with wrong-answer explanations + auto flashcards, concept explainer (three formats + chat), targeted practice with deep feedback
- Optional Claude (`ANTHROPIC_API_KEY`) for practice grading / remedial explanations; HF embeddings for weak-topic matching when `HF_API_KEY` is set
- Adaptive Exam Simulator: dynamic follow-up questions and weakness-based 3-day revision plan
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
- **Supabase (production):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — see below

### Supabase setup (quick)

1. Create a free project at [https://supabase.com](https://supabase.com).
2. Open **SQL Editor** → New query → paste and run the contents of `supabase/migrations/001_app_data_rows.sql`.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (backend only; never put this in the React app or public repos).
4. Add those to `backend/.env` and restart the API. The server log should show `Supabase: ✅ Enabled`.
5. **Optional — import old JSON data:** from `backend/` run `npm run db:migrate-to-supabase` (migrates every `backend/data/*.json` array into `app_data_rows`).

The backend maps each former JSON file (e.g. `users.json`) to rows with the same `collection` name and stable `row_id` keys, so all existing routes keep working without schema rewrites.

## Production Readiness Notes

- Sensitive files are excluded via root `.gitignore` (`.env`, local data files, logs, caches)
- Do not commit backend/data JSON files from local/dev environments
- Rotate API keys before production deployment if they were ever exposed locally
- Use Supabase in production; keep `SUPABASE_SERVICE_ROLE_KEY` only on the server (Render, Railway, Fly.io, VPS, etc.)

## Scripts

Backend:

- `npm run dev` — start API with nodemon
- `npm run start` — start API in production mode
- `npm run db:migrate-to-supabase` — upload `backend/data/*.json` into Supabase (requires env vars)

Frontend:

- `npm run dev` — start Vite dev server
- `npm run build` — production build

## License

This project is currently maintained as a personal/portfolio project.
