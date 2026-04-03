import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getMergedGraphForUser } from '../services/graphMerge.js';

const router = express.Router();

/** GET /api/study/graph — merged react-flow friendly graph */
router.get('/', authMiddleware, (req, res) => {
  const graph = getMergedGraphForUser(req.userId);
  res.json(graph);
});

export default router;
