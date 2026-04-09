import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  exportRoadmapPdfData,
  generateRoadmap,
  getRoadmap,
  getShareRoadmap,
  getTodaySuggestion,
  patchRoadmap,
  updateProgress,
} from './service.js';

const router = express.Router();

router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const roadmap = await generateRoadmap(req.userId, req.body || {});
    res.status(201).json({ roadmap });
  } catch (error) {
    console.error('roadmap generate failed', error);
    res.status(500).json({ error: 'Failed to generate roadmap.' });
  }
});

router.get('/:userId', authMiddleware, async (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const roadmap = await getRoadmap(req.userId);
  if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
  res.json({ roadmap });
});

router.patch('/:userId', authMiddleware, async (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const roadmap = await patchRoadmap(req.userId, req.body || {});
  if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
  res.json({ roadmap });
});

router.put('/:userId', authMiddleware, async (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const roadmap = await patchRoadmap(req.userId, req.body || {});
  if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
  res.json({ roadmap });
});

router.post('/progress', authMiddleware, async (req, res) => {
  const roadmap = await updateProgress(req.userId, req.body || {});
  if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
  res.json({ roadmap });
});

router.get('/today/:userId', authMiddleware, async (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const today = await getTodaySuggestion(req.userId);
  if (!today) return res.status(404).json({ error: 'Roadmap not found' });
  res.json({ today });
});

router.get('/share/:shareId', async (req, res) => {
  const roadmap = await getShareRoadmap(req.params.shareId);
  if (!roadmap) return res.status(404).json({ error: 'Share not found' });
  res.json({ roadmap });
});

router.post('/export/pdf', authMiddleware, async (req, res) => {
  const payload = await exportRoadmapPdfData(req.userId);
  if (!payload) return res.status(404).json({ error: 'Roadmap not found' });
  res.json(payload);
});

export default router;
