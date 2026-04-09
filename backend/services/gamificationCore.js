import { readDB, writeDB } from '../middleware/db.js';

const XP_PER_QUIZ_POINT = 2;
const XP_LEVEL_STEP = 500;

export async function getOrCreateGamification(userId) {
  const all = await readDB('gamification');
  let row = all.find((r) => r.userId === userId);
  if (!row) {
    row = {
      userId,
      xp: 0,
      level: 1,
      streak: 0,
      lastStreakDate: null,
      updatedAt: new Date().toISOString(),
    };
    all.push(row);
    await writeDB('gamification', all);
  }
  return row;
}

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

function updateStreak(row) {
  const d = todayUTC();
  if (!row.lastStreakDate) {
    row.streak = 1;
    row.lastStreakDate = d;
    return;
  }
  if (row.lastStreakDate === d) return;
  const prev = new Date(row.lastStreakDate + 'T12:00:00Z');
  const cur = new Date(d + 'T12:00:00Z');
  const diffDays = Math.round((cur - prev) / (24 * 3600 * 1000));
  if (diffDays === 1) row.streak += 1;
  else if (diffDays > 1) row.streak = 1;
  row.lastStreakDate = d;
}

export async function awardXp(userId, amount, _reason) {
  if (!amount || amount < 0) return getOrCreateGamification(userId);
  const all = await readDB('gamification');
  let idx = all.findIndex((r) => r.userId === userId);
  if (idx === -1) {
    await getOrCreateGamification(userId);
    return awardXp(userId, amount, _reason);
  }
  const row = { ...all[idx] };
  updateStreak(row);
  row.xp = (row.xp || 0) + amount;
  row.level = Math.max(1, Math.floor(row.xp / XP_LEVEL_STEP) + 1);
  row.updatedAt = new Date().toISOString();
  all[idx] = row;
  await writeDB('gamification', all);
  return row;
}

export function xpFromQuizScore(scorePercent, totalQuestions) {
  const base = Math.round((scorePercent / 100) * (totalQuestions || 10) * XP_PER_QUIZ_POINT);
  return Math.max(5, Math.min(200, base + 10));
}

export async function listLeaderboard(limit = 20) {
  const users = await readDB('users');
  const gm = await readDB('gamification');
  const merged = gm.map((g) => {
    const u = users.find((x) => x.id === g.userId);
    return {
      userId: g.userId,
      name: u?.name || 'Student',
      xp: g.xp || 0,
      level: g.level || 1,
      streak: g.streak || 0,
    };
  });
  merged.sort((a, b) => b.xp - a.xp);
  return merged.slice(0, limit);
}
