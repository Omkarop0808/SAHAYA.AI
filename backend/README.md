# Sahay.AI Backend

Express.js backend + Python AI model for the Sahay.AI study platform.

## Quick Start

```bash
npm install
npm run setup-ai        # installs Python deps (scikit-learn, pandas, joblib)
cp .env.example .env   # fill in your keys
npm run dev            # starts on port 5000
```

## Environment Variables

```env
PORT=5000
JWT_SECRET=any_long_random_string

ANTHROPIC_API_KEY=sk-ant-...       # from console.anthropic.com

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=yourgmail@gmail.com
MAIL_PASS=xxxx xxxx xxxx xxxx     # Google App Password
MAIL_FROM_NAME=Sahay.AI Support

FRONTEND_URL=http://localhost:5173
```

## AI Model (RandomForest)

The ML model lives in `ai_service/`. Node.js calls it via Python child_process — no extra server needed.

### Inputs (auto-collected from user activity):

| Parameter | Source |
|---|---|
| `study_hours` | Timetable page — hours per day set by user |
| `focus_level` | Session tracking — active time ÷ total online × 10 |
| `breaks` | Session tracking — tab hidden >5 min = break |
| `difficulty_level` | `5 − (accuracy × 4)` from quiz scores per subject |
| `previous_score` | Last quiz score; first quiz → current score = previous |

### Outputs:

- `recommended_hours` — AI-recommended daily study hours
- `predicted_performance` — predicted score % if user follows recommendation
- `timetable` — per-subject hour allocation (more hours for weaker subjects)

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | No | Register |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | Yes | Verify token |
| GET/POST | `/api/profile/edu` | Yes | Education data |
| GET/POST | `/api/exams` | Yes | Exam dates |
| GET/POST | `/api/growth` | Yes | Growth scores |
| GET/POST | `/api/timetable` | Yes | Saved schedule |
| GET/POST | `/api/subjects/:subject` | Yes | Subject notes/summary/questions |
| POST | `/api/ai/questions` | Yes | Generate questions (Claude) |
| POST | `/api/ai/summarize` | Yes | Summarize notes (Claude) |
| POST | `/api/ai/schedule` | Yes | Generate day schedule (Claude) |
| POST | `/api/ai/ask` | Yes | Ask study question (Claude) |
| POST | `/api/ai/materials` | Yes | Recommend materials (Claude) |
| POST | `/api/ai/growth` | Yes | Analyze growth (Claude) |
| POST | `/api/ai-predict` | Yes | **ML prediction + timetable** |
| GET | `/api/quiz/:subject` | Yes | Quiz history per subject |
| GET | `/api/quiz/summary/all` | Yes | Latest attempt summary (all subjects) |
| POST | `/api/quiz/save` | Yes | Save quiz attempt + score |
| POST | `/api/session/heartbeat` | Yes | Track online time (60s intervals) |
| GET | `/api/session/today` | Yes | Today's session stats |
| GET | `/api/session/recent` | Yes | Last 7 days sessions |
| POST | `/api/contact` | No | Send contact email |

## Data Files

All stored in `./data/*.json`:
- `users.json` — accounts (bcrypt hashed passwords)
- `edu_data.json` — education profiles
- `exams.json` — exam schedules
- `growth.json` — growth analysis
- `timetable.json` — saved schedules
- `subject_data.json` — notes/summaries/questions per subject
- `quiz_attempts.json` — all quiz attempts (never overwritten, full history)
- `sessions.json` — daily session stats per user
