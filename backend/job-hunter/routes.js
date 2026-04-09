import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getApplication, listApplications, streamRunEvents, triggerAutoApply } from './auto-applier.service.js';
import { listOutreach, sendOutreach, updateOutreachStatus } from './outreach.service.js';

const router = express.Router();

router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const application = await triggerAutoApply(req.userId, req.body || {});
    res.status(201).json({ application });
  } catch (error) {
    console.error('job-hunter/apply failed', error);
    res.status(500).json({ error: 'Failed to trigger auto apply pipeline.' });
  }
});

router.get('/applications', authMiddleware, async (req, res) => {
  try {
    const applications = await listApplications(req.userId);
    res.json({ applications });
  } catch (error) {
    console.error('job-hunter/applications failed', error);
    res.status(500).json({ error: 'Failed to fetch applications.' });
  }
});

router.get('/applications/:applicationId/stream', authMiddleware, async (req, res) => {
  const application = await getApplication(req.userId, req.params.applicationId);
  if (!application) return res.status(404).json({ error: 'Application not found.' });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  });
  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const heartbeat = setInterval(() => send({ type: 'ping', ts: new Date().toISOString() }), 15000);
  send({ type: 'snapshot', runId: application.id, status: application.status, logs: application.logs || [], ts: new Date().toISOString() });
  const unsubscribe = streamRunEvents(application.id, send);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

router.post('/outreach', authMiddleware, async (req, res) => {
  try {
    const outreach = await sendOutreach(req.userId, req.body || {});
    res.status(201).json({ outreach });
  } catch (error) {
    console.error('job-hunter/outreach failed', error);
    res.status(500).json({ error: 'Failed to send outreach.' });
  }
});

router.get('/outreach', authMiddleware, async (req, res) => {
  try {
    const outreach = await listOutreach(req.userId);
    res.json({ outreach });
  } catch (error) {
    console.error('job-hunter/outreach list failed', error);
    res.status(500).json({ error: 'Failed to fetch outreach history.' });
  }
});

router.patch('/outreach/:outreachId/status', authMiddleware, async (req, res) => {
  try {
    const outreach = await updateOutreachStatus(req.userId, req.params.outreachId, req.body?.status);
    if (!outreach) return res.status(404).json({ error: 'Outreach not found.' });
    res.json({ outreach });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update outreach status.' });
  }
});

router.put('/outreach/:outreachId/status', authMiddleware, async (req, res) => {
  try {
    const outreach = await updateOutreachStatus(req.userId, req.params.outreachId, req.body?.status);
    if (!outreach) return res.status(404).json({ error: 'Outreach not found.' });
    res.json({ outreach });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update outreach status.' });
  }
});

export default router;
