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
