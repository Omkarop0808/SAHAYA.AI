import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listApplications, triggerAutoApply } from './auto-applier.service.js';
import { listOutreach, sendOutreach } from './outreach.service.js';

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

export default router;
