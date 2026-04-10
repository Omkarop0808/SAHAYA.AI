import api from './api';

export async function getCareerDashboard() {
  const { data } = await api.get('/career/dashboard');
  return data;
}

export async function getCareerAnalyticsSummary() {
  const { data } = await api.get('/career/analytics/summary');
  return data;
}

export async function getGamificationQuests(world = 'career') {
  const { data } = await api.get('/gamification/quests', { params: { world } });
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

export async function getSavedResumeProfile() {
  const { data } = await api.get('/career/resume/profile');
  return data;
}

export async function uploadResumePdf(file) {
  const formData = new FormData();
  formData.append('resumePdf', file);
  const { data } = await api.postMultipart('/career/resume/upload-pdf', formData);
  return data;
}

export async function getRoleIntelligence(goal) {
  const q = encodeURIComponent(goal || 'Software Engineer');
  const { data } = await api.get(`/career/resume/role-intelligence?goal=${q}`);
  return data;
}

export async function getRoleIntelligencePersonalized(payload) {
  const { data } = await api.post('/career/resume/role-intelligence', payload);
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

export async function startRecruiterSim(payload) {
  const { data } = await api.post('/career/resume/recruiter-sim/start', payload);
  return data;
}

export async function completeRecruiterSim(payload) {
  const { data } = await api.post('/career/resume/recruiter-sim/complete', payload);
  return data;
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

// ----------------------------
// SkillScan (Career Roadmap tabs)
// ----------------------------
export async function skillscanParseResume(payload) {
  const { data } = await api.post('/career/skillscan/resume/parse', payload);
  return data;
}

export async function skillscanAtsScore(payload) {
  const { data } = await api.post('/career/skillscan/resume/ats-score', payload);
  return data;
}

export async function skillscanAnalyzeSkills(payload) {
  const { data } = await api.post('/career/skillscan/skills/analyze', payload);
  return data;
}

export async function skillscanJobMatch(payload) {
  const { data } = await api.post('/career/skillscan/job-match', payload);
  return data;
}

export async function skillscanLinkedInAnalyze(payload) {
  const { data } = await api.post('/career/skillscan/linkedin/analyze', payload);
  return data;
}

export async function skillscanSalaryIntel(payload) {
  const { data } = await api.post('/career/skillscan/salary/intel', payload);
  return data;
}

export async function skillscanNegotiationScript(payload) {
  const { data } = await api.post('/career/skillscan/salary/negotiation-script', payload);
  return data;
}

export async function skillscanListApplications() {
  const { data } = await api.get('/career/skillscan/applications');
  return data;
}

export async function skillscanAddApplication(payload) {
  const { data } = await api.post('/career/skillscan/applications', payload);
  return data;
}

export async function skillscanPatchApplication(appId, payload) {
  const { data } = await api.patch(`/career/skillscan/applications/${encodeURIComponent(appId)}`, payload);
  return data;
}

export async function skillscanDeleteApplication(appId) {
  const { data } = await api.delete(`/career/skillscan/applications/${encodeURIComponent(appId)}`);
  return data;
}

export async function skillscanRejectionAnalysis() {
  const { data } = await api.post('/career/skillscan/applications/rejection-analysis', {});
  return data;
}

export async function skillscanRecommendCerts(payload) {
  const { data } = await api.post('/career/skillscan/certifications/recommend', payload);
  return data;
}

export async function skillscanListTrackedCerts() {
  const { data } = await api.get('/career/skillscan/certifications/tracker');
  return data;
}

export async function skillscanAddTrackedCert(payload) {
  const { data } = await api.post('/career/skillscan/certifications/tracker', payload);
  return data;
}

export async function skillscanPatchTrackedCert(id, payload) {
  const { data } = await api.patch(`/career/skillscan/certifications/tracker/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function skillscanChat(payload) {
  const { data } = await api.post('/career/skillscan/chat', payload);
  return data;
}

export async function startCareerSocraticSession(payload) {
  const { data } = await api.post('/career/socratic/start', payload);
  return data;
}

export async function sendCareerSocraticTurn(payload) {
  const { data } = await api.post('/career/socratic/turn', payload);
  return data;
}
