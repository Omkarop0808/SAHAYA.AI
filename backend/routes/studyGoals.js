import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { findAll, readDB, writeDB } from '../middleware/db.js';
import { callGeminiJSON } from '../services/gemini.js';
import { awardXp } from '../services/gamificationCore.js';

const router = express.Router();

/** GET /api/study/goals */
router.get('/', authMiddleware, (req, res) => {
  const goals = findAll('study_goals', (g) => g.userId === req.userId);
  goals.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ goals });
});

/** POST /api/study/goals — body: { title, deadline } */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, deadline } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    const system = `Output ONLY JSON: {
  "weekly_sprints": [
    {
      "week_index": 1,
      "theme": "string",
      "tasks": [
        { "id": "t1", "title": "string", "day": "mon|tue|wed|thu|fri|sat|sun", "resource_type": "quiz|video|hub|subject", "resource_hint": "path or subject name" }
      ]
    }
  ]
}
Provide 2-4 weekly sprints; 3-6 tasks per sprint. resource_type must be one of quiz|video|hub|subject.`;
    const user = `Goal: ${title}\nDeadline: ${deadline || 'flexible'}\nBreak into achievable weekly sprints with tasks linking to app areas (quiz, hub upload, subject notebook).`;
    const parsed = await callGeminiJSON(system, user, 4096);
    const goal = {
      id: uuidv4(),
      userId: req.userId,
      title: title.trim(),
      deadline: deadline || null,
      weekly_sprints: parsed.weekly_sprints || [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const all = readDB('study_goals');
    all.push(goal);
    writeDB('study_goals', all);
    awardXp(req.userId, 20, 'goal_created');
    res.json({ goal });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Goal create failed' });
  }
});

/** POST /api/study/goals/:id/task — body: { sprintIndex, taskId, done } */
router.post('/:id/task', authMiddleware, (req, res) => {
  const { sprintIndex, taskId, done } = req.body;
  const all = readDB('study_goals');
  const idx = all.findIndex((g) => g.id === req.params.id && g.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const goal = all[idx];
  const sp = goal.weekly_sprints?.[sprintIndex];
  if (!sp) return res.status(400).json({ error: 'Invalid sprint' });
  const task = sp.tasks?.find((t) => t.id === taskId);
  if (!task) return res.status(400).json({ error: 'Invalid task' });
  task.done = !!done;
  task.completedAt = done ? new Date().toISOString() : null;
  goal.updatedAt = new Date().toISOString();

  if (done) awardXp(req.userId, 15, 'goal_task');

  const allTasks = goal.weekly_sprints.flatMap((s) => s.tasks || []);
  const allDone = allTasks.length && allTasks.every((t) => t.done);
  if (allDone) {
    goal.status = 'completed';
    awardXp(req.userId, 50, 'goal_completed');
  }

  all[idx] = goal;
  writeDB('study_goals', all);
  res.json({ goal });
});

/** POST /api/study/goals/:id/adjust — roll incomplete tasks forward */
router.post('/:id/adjust', authMiddleware, async (req, res) => {
  const all = readDB('study_goals');
  const idx = all.findIndex((g) => g.id === req.params.id && g.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const goal = all[idx];
  const incomplete = [];
  for (const sp of goal.weekly_sprints || []) {
    for (const t of sp.tasks || []) {
      if (!t.done) incomplete.push({ sprint: sp.week_index, task: t });
    }
  }
  if (!incomplete.length) return res.json({ goal });

  const system = `Output ONLY JSON: { "moves": [{ "taskId": "", "new_week_index": 2, "new_day": "mon" }] }`;
  const user = `Goal: ${goal.title}. Incomplete tasks: ${JSON.stringify(incomplete.map((i) => i.task.title))}. Propose minimal moves to next week.`;
  const parsed = await callGeminiJSON(system, user, 1500);
  const moves = parsed.moves || [];
  for (const m of moves) {
    for (const sp of goal.weekly_sprints) {
      const t = sp.tasks?.find((x) => x.id === m.taskId);
      if (t) {
        t.day = m.new_day || t.day;
        sp.week_index = m.new_week_index ?? sp.week_index;
      }
    }
  }
  goal.updatedAt = new Date().toISOString();
  all[idx] = goal;
  writeDB('study_goals', all);
  res.json({ goal });
});

export default router;
