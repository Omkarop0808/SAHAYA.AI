import { callGeminiJSON } from './gemini.js';
import { youtubeSearchTopVideos } from './youtube.js';

const BUNDLE_SCHEMA_HINT = `You are an expert learning scientist. Output ONLY valid JSON with this exact structure:
{
  "summary": "string (clear markdown-style text allowed)",
  "mind_map": { "nodes": [{"id": "string", "label": "string"}], "edges": [{"source": "node id", "target": "node id", "label": "short relationship"}] },
  "self_test_questions": [{"question": "string", "answer": "string"}],
  "flashcards": [{"front": "string", "back": "string"}],
  "question_bank": [{"question": "string", "type": "mcq", "options": ["A","B","C","D"], "answer": "exact option text"}, {"question": "string", "type": "short", "options": [], "answer": "string"}],
  "roadmap": {
    "title": "string",
    "phases": [{"title": "string", "estimated_days": 1, "tasks": ["string"]}]
  },
  "youtube_queries": [{"title": "string", "why": "string", "search_query": "string"}]
}
Rules: 10-24 mind_map nodes; at least 8 flashcards; at least 6 question_bank items; at least 5 self_test_questions; 3 youtube_queries.`;

export async function generateSmartUploadBundle(subject, fullText) {
  const searchQ = `${subject} ${fullText.slice(0, 400)}`.replace(/\s+/g, ' ').slice(0, 200);
  let apiVideos = [];
  try {
    apiVideos = await youtubeSearchTopVideos(searchQ, 3);
  } catch {
    apiVideos = [];
  }

  const videoHint = apiVideos.length
    ? `These real YouTube results were found — align youtube_queries with them when possible: ${JSON.stringify(apiVideos)}`
    : 'No API videos — use search_query strings only.';

  const user = `Subject/topic: ${subject}\n\n${videoHint}\n\nContent:\n${fullText.slice(0, 80_000)}`;

  const bundle = await callGeminiJSON(BUNDLE_SCHEMA_HINT, user, 8192);

  const enrichedVideos = apiVideos.length
    ? apiVideos.map((v) => ({
        videoId: v.videoId,
        title: v.title,
        channelTitle: v.channelTitle,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
      }))
    : (bundle.youtube_queries || []).map((q) => ({
        videoId: null,
        title: q.title,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q.search_query || q.title)}`,
        reason: q.why,
      }));

  return {
    summary: bundle.summary || '',
    mind_map: bundle.mind_map || { nodes: [], edges: [] },
    self_test_questions: bundle.self_test_questions || [],
    flashcards: bundle.flashcards || [],
    question_bank: bundle.question_bank || [],
    roadmap: bundle.roadmap || { title: '', phases: [] },
    youtube_queries: bundle.youtube_queries || [],
    recommended_videos: enrichedVideos.slice(0, 3),
  };
}
