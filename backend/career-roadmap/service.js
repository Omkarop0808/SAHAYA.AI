import { randomUUID } from 'crypto';
import { findAll, findOne, insertOne, upsertOne, updateOne } from '../middleware/db.js';
import { callGroqChatJSON } from '../services/careerAi.js';

const COL_QUIZ = 'career_roadmap_quiz';
const COL_ROADMAP = 'career_roadmaps_v2';

function nowIso() {
  return new Date().toISOString();
}

function defaultRoadmapFromQuiz(quiz = {}) {
  const role = quiz.targetRole || 'Software Engineer';
  const timeline = quiz.timeline || '1 year';
  const skillHints = Array.isArray(quiz.skills) ? quiz.skills.slice(0, 6) : [];
  return {
    phases: [
      {
        id: 'phase-foundation',
        title: 'Foundation',
        duration: '4-6 weeks',
        state: 'in_progress',
        skills: ['Programming basics', 'Git/GitHub', ...skillHints.slice(0, 2)].map((name) => ({ id: randomUUID(), name, completed: false })),
        resources: [
          { id: randomUUID(), title: 'CS50 / foundational programming', url: 'https://cs50.harvard.edu', completed: false },
          { id: randomUUID(), title: 'Roadmap.sh basics', url: 'https://roadmap.sh', completed: false },
        ],
        projects: [
          { id: randomUUID(), title: 'Portfolio starter project', description: 'Build a simple portfolio site', completed: false, link: '' },
        ],
        milestone: 'Complete one publishable project and core foundations.',
      },
      {
        id: 'phase-core',
        title: 'Core Skills',
        duration: '8-10 weeks',
        state: 'locked',
        skills: ['Data Structures', 'Problem Solving', 'System Design Basics'].map((name) => ({ id: randomUUID(), name, completed: false })),
        resources: [
          { id: randomUUID(), title: 'NeetCode roadmap', url: 'https://neetcode.io/roadmap', completed: false },
        ],
        projects: [{ id: randomUUID(), title: `${role} mini project`, description: 'Domain project aligned to role', completed: false, link: '' }],
        milestone: `Deliver role-aligned projects and interview-ready fundamentals for ${role}.`,
      },
      {
        id: 'phase-job',
        title: 'Job Prep',
        duration: timeline,
        state: 'locked',
        skills: ['Resume & outreach', 'Interview communication'].map((name) => ({ id: randomUUID(), name, completed: false })),
        resources: [{ id: randomUUID(), title: 'Behavioral interview prep', url: 'https://www.pramp.com', completed: false }],
        projects: [{ id: randomUUID(), title: 'Capstone + case study', description: 'Production-style final project', completed: false, link: '' }],
        milestone: 'Ready to apply confidently with portfolio + interview prep.',
      },
    ],
  };
}

function normalizePhaseState(phases = []) {
  let seenInProgress = false;
  return phases.map((phase, idx) => {
    const done = [...(phase.skills || []), ...(phase.resources || []), ...(phase.projects || [])]
      .every((item) => item.completed);
    if (done) return { ...phase, state: 'completed' };
    if (!seenInProgress) {
      seenInProgress = true;
      return { ...phase, state: 'in_progress' };
    }
    return { ...phase, state: idx === 0 ? 'in_progress' : 'locked' };
  });
}

function computeProgress(roadmap) {
  const items = roadmap?.phases?.flatMap((p) => [...(p.skills || []), ...(p.resources || []), ...(p.projects || [])]) || [];
  const total = items.length;
  const done = items.filter((x) => x.completed).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, percent };
}

export async function saveQuiz(userId, quiz) {
  const payload = { id: userId, userId, ...quiz, updatedAt: nowIso() };
  return upsertOne(COL_QUIZ, (x) => x.userId === userId, payload);
}

export async function generateRoadmap(userId, quizInput = {}) {
  const quiz = await saveQuiz(userId, quizInput);
  const fallback = defaultRoadmapFromQuiz(quiz);
  let aiPhases = null;
  try {
    const system = 'You are an expert career mentor. Return strict JSON only.';
    const prompt = `Generate a student-focused career roadmap with 3-6 phases for this profile:\n${JSON.stringify(quiz)}\nReturn {"phases":[{"title":"","duration":"","skills":[""],"resources":[{"title":"","url":""}],"projects":[{"title":"","description":""}],"milestone":""}]}`;
    const parsed = await callGroqChatJSON(system, prompt, 1300);
    aiPhases = Array.isArray(parsed?.phases) ? parsed.phases : null;
  } catch {
    aiPhases = null;
  }

  const phases = aiPhases
    ? aiPhases.slice(0, 6).map((phase, idx) => ({
      id: `phase-${idx + 1}`,
      title: phase.title || `Phase ${idx + 1}`,
      duration: phase.duration || '4-6 weeks',
      state: idx === 0 ? 'in_progress' : 'locked',
      skills: (phase.skills || []).map((name) => ({ id: randomUUID(), name: String(name), completed: false })),
      resources: (phase.resources || []).map((r) => ({ id: randomUUID(), title: r.title || 'Resource', url: r.url || '', completed: false })),
      projects: (phase.projects || []).map((p) => ({ id: randomUUID(), title: p.title || 'Project', description: p.description || '', completed: false, link: '' })),
      milestone: phase.milestone || '',
    }))
    : fallback.phases;

  const shareId = randomUUID().slice(0, 12);
  const doc = {
    id: userId,
    userId,
    shareId,
    quiz,
    phases: normalizePhaseState(phases),
    customMilestones: [],
    resourcesExtra: [],
    streak: 0,
    lastActiveDate: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await upsertOne(COL_ROADMAP, (x) => x.userId === userId, doc);
  return { ...doc, progress: computeProgress(doc) };
}

export async function getRoadmap(userId) {
  const roadmap = await findOne(COL_ROADMAP, (x) => x.userId === userId);
  if (!roadmap) return null;
  return { ...roadmap, progress: computeProgress(roadmap) };
}

export async function patchRoadmap(userId, patch = {}) {
  const current = await findOne(COL_ROADMAP, (x) => x.userId === userId);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    phases: normalizePhaseState(Array.isArray(patch.phases) ? patch.phases : current.phases),
    updatedAt: nowIso(),
  };
  await updateOne(COL_ROADMAP, (x) => x.userId === userId, next);
  return { ...next, progress: computeProgress(next) };
}

export async function updateProgress(userId, payload = {}) {
  const current = await findOne(COL_ROADMAP, (x) => x.userId === userId);
  if (!current) return null;
  const { itemId, completed = true, projectLink = '' } = payload;
  const phases = (current.phases || []).map((phase) => {
    const patchItems = (items = []) => items.map((item) => {
      if (item.id !== itemId) return item;
      return { ...item, completed: Boolean(completed), ...(projectLink ? { link: projectLink } : {}) };
    });
    return {
      ...phase,
      skills: patchItems(phase.skills),
      resources: patchItems(phase.resources),
      projects: patchItems(phase.projects),
    };
  });
  const today = new Date().toISOString().slice(0, 10);
  const streak = current.lastActiveDate === today ? current.streak : (current.streak || 0) + 1;
  const next = { ...current, phases: normalizePhaseState(phases), streak, lastActiveDate: today, updatedAt: nowIso() };
  await updateOne(COL_ROADMAP, (x) => x.userId === userId, next);
  return { ...next, progress: computeProgress(next) };
}

export async function getTodaySuggestion(userId) {
  const roadmap = await findOne(COL_ROADMAP, (x) => x.userId === userId);
  if (!roadmap) return null;
  const inProgress = (roadmap.phases || []).find((p) => p.state === 'in_progress') || roadmap.phases?.[0];
  const nextTask =
    inProgress?.skills?.find((s) => !s.completed)?.name ||
    inProgress?.resources?.find((r) => !r.completed)?.title ||
    inProgress?.projects?.find((p) => !p.completed)?.title ||
    'Review your completed work and refine your resume.';
  const etaWeeks = Math.max(1, Math.ceil(((100 - computeProgress(roadmap).percent) / 100) * 12));
  return {
    today: `Focus on "${nextTask}" for 60-90 minutes.`,
    etaWeeks,
    phase: inProgress?.title || 'Foundation',
  };
}

export async function getShareRoadmap(shareId) {
  const row = await findOne(COL_ROADMAP, (x) => x.shareId === shareId);
  if (!row) return null;
  return {
    shareId: row.shareId,
    quiz: row.quiz,
    phases: row.phases,
    progress: computeProgress(row),
    updatedAt: row.updatedAt,
  };
}

export async function exportRoadmapPdfData(userId) {
  const roadmap = await findOne(COL_ROADMAP, (x) => x.userId === userId);
  if (!roadmap) return null;
  const lines = [
    'Career Roadmap Export',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Target Role: ${roadmap.quiz?.targetRole || 'N/A'}`,
    `Timeline: ${roadmap.quiz?.timeline || 'N/A'}`,
    '',
  ];
  for (const phase of roadmap.phases || []) {
    lines.push(`## ${phase.title} (${phase.duration})`);
    lines.push(`Milestone: ${phase.milestone || 'N/A'}`);
    lines.push(`Skills: ${(phase.skills || []).map((x) => `${x.completed ? '[x]' : '[ ]'} ${x.name}`).join(', ')}`);
    lines.push(`Resources: ${(phase.resources || []).map((x) => `${x.completed ? '[x]' : '[ ]'} ${x.title}`).join(', ')}`);
    lines.push(`Projects: ${(phase.projects || []).map((x) => `${x.completed ? '[x]' : '[ ]'} ${x.title}`).join(', ')}`);
    lines.push('');
  }
  const content = lines.join('\n');
  return {
    filename: 'career-roadmap.pdf',
    mimeType: 'application/pdf',
    // Placeholder PDF-friendly payload for client-side download; avoids new backend dependencies.
    contentBase64: Buffer.from(content, 'utf8').toString('base64'),
  };
}

export async function listRoadmapRows() {
  return findAll(COL_ROADMAP, () => true);
}
