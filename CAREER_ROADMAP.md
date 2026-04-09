# Career Roadmap Feature

## Overview

Career World now includes an AI-powered roadmap planner at `/career/roadmap` with:

- onboarding quiz (education, skills, role, timeline, learning style)
- AI-generated roadmap phases (Groq via backend)
- expandable phase cards for skills/resources/projects/milestones
- progress tracking with checklist updates
- streak + "what to do today" guidance
- share endpoint and export endpoint support

## Backend Module

- `backend/career-roadmap/routes.js`
- `backend/career-roadmap/service.js`

Mounted under:

- `/api/roadmap`

Endpoints:

- `POST /api/roadmap/generate`
- `GET /api/roadmap/:userId`
- `PATCH /api/roadmap/:userId`
- `PUT /api/roadmap/:userId`
- `POST /api/roadmap/progress`
- `GET /api/roadmap/today/:userId`
- `GET /api/roadmap/share/:shareId`
- `POST /api/roadmap/export/pdf`

## Storage Collections

Stored in existing DB abstraction collections:

- `career_roadmap_quiz`
- `career_roadmaps_v2`

## AI Provider Pattern

Uses existing Career World AI service:

- `callGroqChatJSON` from `backend/services/careerAi.js`

No frontend API keys are used.

