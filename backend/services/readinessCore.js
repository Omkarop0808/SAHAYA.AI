import { readDB, writeDB } from '../middleware/db.js';

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export async function applyQuizScoreToReadiness(userId, subject, scorePercent, totalQuestions = 10) {
  if (!subject) return null;
  const all = await readDB('study_readiness');
  const idx = all.findIndex((r) => r.userId === userId && r.subject === subject);
  const prev = idx >= 0 ? all[idx].score : 45;
  const weight = Math.min(0.45, 0.2 + (totalQuestions || 10) * 0.02);
  const blended = prev * (1 - weight) + scorePercent * weight;
  const row = {
    userId,
    subject,
    score: Math.round(clamp(blended, 8, 98)),
    lastScore: scorePercent,
    updatedAt: new Date().toISOString(),
  };
  if (idx === -1) all.push(row);
  else all[idx] = { ...all[idx], ...row };
  await writeDB('study_readiness', all);
  return row;
}

export async function applyAdaptiveSessionToReadiness(userId, subject, accuracy) {
  const pct = Math.round(accuracy * 100);
  return applyQuizScoreToReadiness(userId, subject, pct, 12);
}

export async function getReadinessForUser(userId) {
  const all = await readDB('study_readiness');
  return all.filter((r) => r.userId === userId);
}

export async function getReadinessSummary(userId) {
  const rows = await getReadinessForUser(userId);
  if (!rows.length) return { overall: null, subjects: [] };
  const avg = Math.round(rows.reduce((s, r) => s + (r.score || 0), 0) / rows.length);
  return {
    overall: avg,
    subjects: rows.map((r) => ({ subject: r.subject, score: r.score, updatedAt: r.updatedAt })),
  };
}
