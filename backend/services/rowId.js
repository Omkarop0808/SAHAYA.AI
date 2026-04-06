import { randomUUID } from 'crypto';

/**
 * Stable primary key for (collection, document) in app_data_rows.
 * Prefer doc.id; otherwise composite keys for singleton-per-user rows.
 */
export function computeRowId(collection, doc) {
  if (doc == null || typeof doc !== 'object') return randomUUID();
  if (doc.id != null && String(doc.id).length) return String(doc.id);

  switch (collection) {
    case 'edu_data':
    case 'exams':
    case 'timetable':
    case 'gamification':
      return doc.userId ? String(doc.userId) : randomUUID();
    case 'subject_data':
      return doc.userId != null && doc.subject != null ? `${doc.userId}__${doc.subject}` : randomUUID();
    case 'growth':
      return doc.userId != null && doc.subject != null ? `${doc.userId}__${doc.subject}` : randomUUID();
    case 'sessions':
      return doc.userId && doc.date ? `${doc.userId}__${doc.date}` : randomUUID();
    case 'study_daily_plans':
      return doc.userId && doc.date ? `${doc.userId}__${doc.date}` : randomUUID();
    case 'study_readiness':
      return doc.userId != null && doc.subject != null ? `${doc.userId}__${doc.subject}` : randomUUID();
    case 'study_coach_activity':
      return doc.userId ? String(doc.userId) : randomUUID();
    case 'arena_boss_cache':
      return doc.week != null ? String(doc.week) : randomUUID();
    default:
      return randomUUID();
  }
}
