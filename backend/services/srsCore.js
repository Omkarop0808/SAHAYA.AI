import { v4 as uuidv4 } from 'uuid';
import { readDB, writeDB } from '../middleware/db.js';

function parseDay(iso) {
  return new Date(iso + 'T12:00:00Z').getTime();
}

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

export async function addSrsCard(userId, subject, front, back, source = 'adaptive_quiz') {
  const all = await readDB('study_srs_cards');
  const row = {
    id: uuidv4(),
    userId,
    subject: subject || 'General',
    front: String(front).slice(0, 2000),
    back: String(back).slice(0, 4000),
    source,
    ease: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: todayUTC(),
    createdAt: new Date().toISOString(),
  };
  all.push(row);
  await writeDB('study_srs_cards', all);
  return row;
}

export async function getDueCards(userId, limit = 30) {
  const d = todayUTC();
  const all = await readDB('study_srs_cards');
  return all
    .filter((c) => c.userId === userId && c.nextReview <= d)
    .sort((a, b) => parseDay(a.nextReview) - parseDay(b.nextReview))
    .slice(0, limit);
}

export async function reviewSrsCard(cardId, userId, quality) {
  const all = await readDB('study_srs_cards');
  const idx = all.findIndex((c) => c.id === cardId && c.userId === userId);
  if (idx === -1) return null;
  const card = { ...all[idx] };
  let q = Number(quality);
  if (Number.isNaN(q)) q = 3;
  q = Math.max(0, Math.min(5, q));

  if (q < 3) {
    card.repetitions = 0;
    card.interval = 1;
  } else {
    if (card.repetitions === 0) card.interval = 1;
    else if (card.repetitions === 1) card.interval = 6;
    else card.interval = Math.round(card.interval * card.ease);
    card.repetitions += 1;
    card.ease = Math.max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }

  const next = new Date();
  next.setUTCDate(next.getUTCDate() + card.interval);
  card.nextReview = next.toISOString().split('T')[0];
  card.lastReviewedAt = new Date().toISOString();
  all[idx] = card;
  await writeDB('study_srs_cards', all);
  return card;
}
