import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { insertOne, findAll } from '../middleware/db.js';
import { scrapeUrlToText } from '../services/scrapeUrl.js';
import { buildYoutubeStudyContext } from '../services/youtube.js';
import { extractPdfText } from '../services/pdfText.js';
import { generateSmartUploadBundle } from '../services/smartBundle.js';
import { awardXp } from '../services/gamificationCore.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

async function gatherText({ file, body }) {
  if (file?.buffer?.length) {
    const mime = file.mimetype || '';
    if (mime === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf')) {
      return { text: await extractPdfText(file.buffer), sourceType: 'pdf' };
    }
    if (mime.startsWith('text/') || file.originalname?.toLowerCase().endsWith('.txt')) {
      return { text: file.buffer.toString('utf8'), sourceType: 'text_file' };
    }
    throw new Error('Unsupported file type (use PDF or .txt)');
  }
  if (body.rawText?.trim()) {
    return { text: body.rawText.trim(), sourceType: 'paste' };
  }
  if (body.url?.trim()) {
    const t = await scrapeUrlToText(body.url.trim());
    return { text: t, sourceType: 'url' };
  }
  if (body.youtubeUrl?.trim()) {
    const ctx = await buildYoutubeStudyContext(body.youtubeUrl.trim());
    return { text: ctx.text, sourceType: 'youtube', meta: ctx };
  }
  return { text: '', sourceType: null };
}

/** POST /api/study/hub/extract — text only (for Subject page PDF upload) */
router.post('/extract', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });
    const mime = req.file.mimetype || '';
    let text = '';
    if (mime === 'application/pdf' || req.file.originalname?.toLowerCase().endsWith('.pdf')) {
      text = await extractPdfText(req.file.buffer);
    } else if (mime.startsWith('text/')) {
      text = req.file.buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Only PDF or plain text files' });
    }
    res.json({ text: text.slice(0, 200_000) });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Extract failed' });
  }
});

/** POST /api/study/hub/process — full Smart Upload pipeline */
router.post('/process', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const subject = (req.body.subject || 'General').trim();
    const { text, sourceType, meta } = await gatherText({ file: req.file, body: req.body });
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Provide file, rawText, url, or youtubeUrl' });
    }

    const bundle = await generateSmartUploadBundle(subject, text);
    const doc = {
      id: uuidv4(),
      userId: req.userId,
      subject,
      sourceType: sourceType || 'unknown',
      youtubeMeta: meta || null,
      textPreview: text.slice(0, 800),
      outputs: bundle,
      createdAt: new Date().toISOString(),
    };
    await insertOne('study_documents', doc);
    await awardXp(req.userId, 25, 'smart_upload');

    res.json({ document: doc });
  } catch (e) {
    console.error('study hub process', e);
    res.status(500).json({ error: e.message || 'Processing failed' });
  }
});

/** GET /api/study/hub/documents */
router.get('/documents', authMiddleware, async (req, res) => {
  const docs = await findAll('study_documents', (d) => d.userId === req.userId);
  docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ documents: docs });
});

/** GET /api/study/hub/documents/:id */
router.get('/documents/:id', authMiddleware, async (req, res) => {
  const list = await findAll('study_documents', (d) => d.userId === req.userId && d.id === req.params.id);
  const doc = list[0];
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ document: doc });
});

export default router;
