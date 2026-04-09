import api from './api';

export async function getCareerDashboard() {
  const { data } = await api.get('/career/dashboard');
  return data;
}

export async function listCareerProblems(params = {}) {
  const { data } = await api.get('/career/problems', { params });
  return data;
}

export async function getCareerProblem(id) {
  const { data } = await api.get(`/career/problems/${encodeURIComponent(id)}`);
  return data;
}

export async function requestCareerHint(payload) {
  const { data } = await api.post('/career/hints', payload);
  return data;
}

export async function submitCareerAttempt(payload) {
  const { data } = await api.post('/career/attempts/submit', payload);
  return data;
}

export async function runCareerAttempt(payload) {
  const { data } = await api.post('/career/attempts/run', payload);
  return data;
}

export async function getCareerConceptMap() {
  const { data } = await api.get('/career/concept-map');
  return data;
}

export async function setCareerTopicState(payload) {
  const { data } = await api.post('/career/concept-map/state', payload);
  return data;
}

export async function fetchConceptLesson(payload) {
  const { data } = await api.post('/career/concept-map/lesson', payload);
  return data;
}

export async function createCareerRoom() {
  const { data } = await api.post('/career/rooms/create', {});
  return data;
}

export async function joinCareerRoom(roomCode) {
  const { data } = await api.post('/career/rooms/join', { roomCode });
  return data;
}

export async function getCareerRoom(roomId) {
  const { data } = await api.get(`/career/rooms/${encodeURIComponent(roomId)}`);
  return data;
}

export async function startCareerRoom(roomId) {
  const { data } = await api.post(`/career/rooms/${encodeURIComponent(roomId)}/start`, {});
  return data;
}

export async function submitDuelCode(roomId, payload) {
  const { data } = await api.post(`/career/rooms/${encodeURIComponent(roomId)}/submit`, payload);
  return data;
}

export async function analyzeResume(payload) {
  const { data } = await api.post('/career/resume/analyze', payload);
  return data;
}

export async function getRoleIntelligence(goal) {
  const { data } = await api.get('/career/resume/role-intelligence', { params: { goal } });
  return data;
}

export async function scanJobDescription(payload) {
  const { data } = await api.post('/career/resume/jd-scan', payload);
  return data;
}

export async function buildApplicationKit(payload) {
  const { data } = await api.post('/career/resume/application-kit', payload);
  return data;
}

export async function jobHunterApply(payload) {
  const { data } = await api.post('/job-hunter/apply', payload);
  return data;
}

export async function jobHunterApplications() {
  const { data } = await api.get('/job-hunter/applications');
  return data;
}

export async function jobHunterOutreach(payload) {
  const { data } = await api.post('/job-hunter/outreach', payload);
  return data;
}

export async function jobHunterOutreachList() {
  const { data } = await api.get('/job-hunter/outreach');
  return data;
}

export async function updateJobHunterOutreachStatus(outreachId, status) {
  const { data } = await api.put(`/job-hunter/outreach/${encodeURIComponent(outreachId)}/status`, { status });
  return data;
}

export async function streamJobHunterRun(applicationId, { onData, signal } = {}) {
  const token = localStorage.getItem('stai_token');
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5006/api';
  const res = await fetch(`${baseUrl}/job-hunter/applications/${encodeURIComponent(applicationId)}/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      const line = chunk.split('\n').find((x) => x.startsWith('data: '));
      if (!line) continue;
      try {
        onData?.(JSON.parse(line.slice(6)));
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export async function generateRoadmap(payload) {
  const { data } = await api.post('/roadmap/generate', payload);
  return data;
}

export async function getRoadmap(userId) {
  const { data } = await api.get(`/roadmap/${encodeURIComponent(userId)}`);
  return data;
}

export async function patchRoadmap(userId, payload) {
  const { data } = await api.put(`/roadmap/${encodeURIComponent(userId)}`, payload);
  return data;
}

export async function updateRoadmapProgress(payload) {
  const { data } = await api.post('/roadmap/progress', payload);
  return data;
}

export async function getRoadmapToday(userId) {
  const { data } = await api.get(`/roadmap/today/${encodeURIComponent(userId)}`);
  return data;
}

export async function exportRoadmapPdf() {
  const { data } = await api.post('/roadmap/export/pdf', {});
  return data;
}
