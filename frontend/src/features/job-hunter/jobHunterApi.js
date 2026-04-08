import api from '../../utils/api';

export async function applyJobs(payload) {
  const { data } = await api.post('/job-hunter/apply', payload);
  return data;
}

export async function getApplications() {
  const { data } = await api.get('/job-hunter/applications');
  return data;
}

export async function sendOutreach(payload) {
  const { data } = await api.post('/job-hunter/outreach', payload);
  return data;
}

export async function getOutreachHistory() {
  const { data } = await api.get('/job-hunter/outreach');
  return data;
}
