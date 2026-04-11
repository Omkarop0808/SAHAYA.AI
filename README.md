<div align="center">
  <img src="./docs/images/banner.png" alt="SAHAYA.AI Banner" width="100%" />
  
  # SAHAYA.AI — Intelligent Learning & Career System
  
  <p>
    An end-to-end, AI-powered platform integrating adaptive studying, career preparation, real-time mock interviews, and robust gamification. Built for students who want to study smarter, not harder.
  </p>

  <div>
    <img src="https://img.shields.io/badge/React-18.2.0-blue?style=for-the-badge&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/Node.js-Backend-43853D?style=for-the-badge&logo=node.js" alt="Node" />
    <img src="https://img.shields.io/badge/AI-Gemini%20%7C%20Groq-FF9900?style=for-the-badge&logo=google" alt="AI" />
    <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
  </div>
</div>

<br />

## 🌟 Prototype Gallery

*(Add your high-resolution prototype screenshots to the `docs/images/` folder to make this gallery shine!)*

| Dashboard | Study Planner |
| :---: | :---: |
| <img src="./docs/images/dashboard.png" width="400" alt="Dashboard Screenshot" /> | <img src="./docs/images/study-planner.png" width="400" alt="Study Planner Screenshot" /> |
| **Problem Arena (Monaco + AI)** | **Resume Hub (JD Scanner)** |
| <img src="./docs/images/problem-arena.png" width="400" alt="Problem Arena Screenshot" /> | <img src="./docs/images/resume-hub.png" width="400" alt="Resume Hub Screenshot" /> |

---

## 🚀 Core Features

### 📚 Study World
- **Smart Upload Hub:** Upload PDFs, text, or YouTube URLs and let AI generate structured lessons, flashcards, a quiz bank, and practice problems in an instant.
- **Intelligent Study Companion:** Daily time-boxed study tasks, conceptual explainers, targeted practice questions with deep feedback, and auto-generated flashcards.
- **Adaptive Practice Hub:** Contains adaptive quizzes that generate explanations for wrong answers, and an Exam Simulator that generates specific revision plans.
- **AI Timetable Prediction:** Machine-learning-backed recommendations for study hour allocation.

### 💼 Career World
- **Problem Arena:** A fully integrated Monaco code editor to practice DSA (Data Structures & Algorithms). Features a 3-tier AI hint ladder (Nudge → Approach → Full Walkthrough) and code review powered by Gemini.
- **Live Group Discussions (GD):** A real-time, WebRTC-powered video conferencing room using **ZegoCloud** where students enter GDs. Generates AI reports of participation and speech metrics upon completion.
- **Resume Hub:** Includes a highly personalized **JD Scanner** that analyzes resumes against Job Descriptions, Readiness Intelligence, and Recruiter Simulators.
- **Career Roadmap:** Automatically generates personalized engineering paths and project milestones.

### 🎮 Gamification & Engagement
- **Daily Quests:** Auto-resetting daily missions that encourage consistent studying.
- **LevelUp System:** Overlays, XP tracking, and dynamic level scaling.
- **Global Leaderboard:** Compete globally and view top-performing students. 

---

## 🏗 System Architecture

The overarching system utilizes a monolithic Node.js runtime feeding a React SPA, connected with Supabase and multiple AI vendor integrations.

```mermaid
graph TD
    %% Entities
    Client[React Frontend]
    API[Express Backend]
    DB[(Supabase PostgreSQL)]
    ModelML[Python ML Predictor]
    
    %% Third-party APIs
    Gemini[Google Gemini 2.0]
    Groq[Groq Llama-3 API]
    Zego[ZegoCloud WebRTC]
    Tavily[Tavily Search API]

    %% Flow
    Client <-->|REST / JWT| API
    Client <-->|Peer-to-Peer Video| Zego
    
    API <-->|SQL / jsonb API| DB
    API <-->|Subprocess / Exec| ModelML
    API <-->|AI Prompts / JSON| Gemini
    API <-->|Fallbacks / Agents| Groq
    API <-->|Web Context| Tavily
```

### Video Group Discussion Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Zego as ZegoCloud
    participant AI as Gemini/Groq

    User->>Frontend: Enter GD Lobby
    Frontend->>Backend: Request matchmaking/Room ID
    Backend-->>Frontend: Return Room ID & Token parameters
    Frontend->>Zego: Join Room via WebRTC (Camera/Mic)
    Zego-->>User: Live Video Discussion
    User->>Frontend: Click "End Discussion"
    Frontend->>Backend: Post Speech Transcripts & Face Metrics
    Backend->>AI: Analyze participant performance
    AI-->>Backend: Return AI Review parameters
    Backend-->>Frontend: Render GD Analyzer Report
```

---

## 💻 Tech Stack

**Frontend Framework:**
- React 18
- Vite
- Tailwind CSS
- Framer Motion & GSAP (for premium animations)
- Monaco Editor (Code Editing)

**Backend Architecture:**
- Node.js & Express.js
- Supabase (Postgres + `app_data_rows` implementation schema)
- Local Python scripts + Scikit-Learn for AI Predictors
- Socket.io (for specific real-time pipelines)

**WebRTC / Communications:**
- ZegoCloud Prebuilt UI Kit

**AI / Deep Tech:**
- Google Gemini (Main Orchestrator)
- Groq (High-speed Llama 3 fallback)
- Anthropic / Hugging Face (Optional specific models)
- Tavily (Search)

---

## 🛠 Local Development & Setup

### 1. Prerequisites
Ensure you have Node 18+ and Python 3.10+ installed on your machine.

### 2. Backend Setup
```bash
cd backend
npm install

# Copy the environment template
cp .env.example .env
```
Edit the `.env` file to include your **Supabase URL**, **Supabase Service Key**, and **Gemini/Groq API Keys**.

```bash
# Start the Backend (Usually http://localhost:5006)
npm run dev
```

### 3. Frontend Setup
Open a new terminal.
```bash
cd frontend
npm install

# Copy the environment template
cp .env.example .env
```
Make sure `VITE_ZEGO_APP_ID` and `VITE_ZEGO_SERVER_SECRET` are assigned inside the frontend `.env` to make Group Discussions operational.

```bash
# Start the Vite Server
npm run dev
```
Navigate to `http://localhost:5005`

---

## 🗄️ Database (Supabase) Setup

This project uses Supabase in a scalable, schema-less `app_data_rows` format to dynamically support various internal collections (users, posts, stats). 

1. Create a free project at [https://supabase.com](https://supabase.com).
2. Open **SQL Editor** → New query → paste and run the contents of `supabase/migrations/001_app_data_rows.sql`.
3. Add the **Project URL** and **service_role** API keys to the backend `.env`.
4. Run `npm run db:migrate-to-supabase` in the backend folder if you have legacy local `data/*.json` files to import!

---

## 🔒 Environment Variable Reference

### Backend (`/backend/.env`)
- `PORT`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Warning: Never expose this to the Frontend payload)
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `PYTHON_BIN` (If your global python executable differs, ex: `C:\Python311\python.exe`)

### Frontend (`/frontend/.env`)
- `VITE_BACKEND_URL`
- `VITE_ZEGO_APP_ID`
- `VITE_ZEGO_SERVER_SECRET`

---

## 📄 License
This project is currently maintained as a personal/portfolio product showcasing complex integrations for AI and EdTech.

<div align="center">
  <p>Built with ❤️ for intelligent learning.</p>
</div>
