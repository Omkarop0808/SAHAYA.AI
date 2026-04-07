/**
 * AI orchestration: Groq (fast), Gemini, Hugging Face fallback.
 * Optional Claude for deep reasoning when ANTHROPIC_API_KEY is set.
 */
function getGeminiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

function getGroqApiKey() {
  return process.env.GROQ_API_KEY || '';
}

function getGroqModel() {
  return process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
}

function getClaudeKey() {
  return process.env.ANTHROPIC_API_KEY || '';
}

function getClaudeModel() {
  return process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
}

function getHfApiKey() {
  return process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || '';
}

function getModel() {
  return process.env.AI_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';
}

async function readErrorBody(response) {
  try {
    const data = await response.json();
    return data?.error?.message || data?.error || data?.message || JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }
}

/**
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ maxTokens?: number, jsonMode?: boolean }} options
 */
export async function callGemini(systemPrompt, userPrompt, options = {}) {
  const maxTokens = options.maxTokens ?? 1024;
  const jsonMode = options.jsonMode ?? false;
  const GROQ_API_KEY = getGroqApiKey();
  const GEMINI_API_KEY = getGeminiKey();
  const model = getGeminiModel();
  let lastProviderError = '';

  if (GROQ_API_KEY) {
    try {
      return await callGroq(systemPrompt, userPrompt, {
        maxTokens,
        jsonMode,
      });
    } catch (err) {
      lastProviderError = err?.message || 'Groq call failed';
    }
  }

  if (GEMINI_API_KEY) {
    const generationConfig = {
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const body = await readErrorBody(response);
    lastProviderError = `Gemini API Error: ${body}`;

    try {
      return await callHuggingFaceFallback(systemPrompt, userPrompt, maxTokens);
    } catch (fallbackErr) {
      throw new Error(`${lastProviderError} | HF fallback failed: ${fallbackErr.message}`);
    }
  }

  try {
    return await callHuggingFaceFallback(systemPrompt, userPrompt, maxTokens);
  } catch (err) {
    throw new Error(lastProviderError || err.message);
  }
}

/**
 * Deep reasoning: Groq → Gemini → HF (same as callGemini). Claude is not used in-app.
 */
export async function callDeepReason(systemPrompt, userPrompt, options = {}) {
  const maxTokens = options.maxTokens ?? 4096;
  if (process.env.USE_CLAUDE_API === 'true' && getClaudeKey()) {
    try {
      const userContent =
        options.jsonMode
          ? `${userPrompt}\n\nRespond with valid JSON only. No markdown fences.`
          : userPrompt;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getClaudeKey(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: getClaudeModel(),
          max_tokens: maxTokens,
          system: options.jsonMode ? `${systemPrompt}\nOutput JSON only.` : systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.content?.find((b) => b.type === 'text')?.text;
        if (text) return text;
      }
    } catch {
      /* fall through */
    }
  }
  return callGemini(systemPrompt, userPrompt, { maxTokens, jsonMode: options.jsonMode });
}

export async function callDeepReasonJSON(systemPrompt, userPrompt, maxTokens = 4096) {
  const raw = await callDeepReason(systemPrompt, userPrompt, { maxTokens, jsonMode: true });
  const parsed = safeParseJSON(raw);
  if (parsed) return parsed;
  const repair = await callGemini(
    'You output only valid JSON. No markdown.',
    `Fix this to valid JSON only:\n${raw}`,
    { maxTokens: 2048, jsonMode: true },
  );
  const again = safeParseJSON(repair);
  if (again) return again;
  throw new Error('AI returned non-JSON output.');
}

/** Hugging Face sentence embedding (MiniLM). Returns number[] or null. */
export async function embedTextMiniLM(text) {
  const HF_API_KEY = getHfApiKey();
  if (!HF_API_KEY || !text?.trim()) return null;
  const inputs = text.trim().slice(0, 8000);
  const url =
    'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction';
  const fallback = `https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2`;
  for (const endpoint of [url, fallback]) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HF_API_KEY}`,
        },
        body: JSON.stringify({ inputs }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      let vec = Array.isArray(data) ? data.flat() : data;
      if (Array.isArray(vec?.[0])) vec = vec[0];
      if (Array.isArray(vec) && vec.every((n) => typeof n === 'number')) return vec;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

export async function callGeminiJSON(systemPrompt, userPrompt, maxTokens = 4096) {
  const raw = await callGemini(systemPrompt, userPrompt, { maxTokens, jsonMode: true });
  const parsed = safeParseJSON(raw);
  if (parsed) return parsed;
  const repair = await callGemini(
    'You output only valid JSON. No markdown.',
    `Fix this to valid JSON only:\n${raw}`,
    { maxTokens: 2048, jsonMode: true },
  );
  const again = safeParseJSON(repair);
  if (again) return again;
  throw new Error('AI returned non-JSON output.');
}

function safeParseJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function callHuggingFaceFallback(systemPrompt, userPrompt, maxTokens) {
  const HF_API_KEY = getHfApiKey();
  if (!HF_API_KEY) {
    throw new Error('Missing AI API key. Set GEMINI_API_KEY or HF_API_KEY.');
  }
  const MODEL = getModel();
  const modelCandidates = [...new Set([MODEL, 'meta-llama/Llama-3.1-8B-Instruct', 'meta-llama/Meta-Llama-3.1-8B-Instruct'])];
  const basePayload = {
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
  let lastError = '';
  for (const model of modelCandidates) {
    const endpoints = [
      'https://router.huggingface.co/v1/chat/completions',
      `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}/v1/chat/completions`,
    ];
    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HF_API_KEY}`,
        },
        body: JSON.stringify({ ...basePayload, model }),
      });
      if (!response.ok) {
        lastError = await readErrorBody(response);
        continue;
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return content;
    }
  }
  throw new Error(lastError || 'Hugging Face AI call failed.');
}

async function callGroq(systemPrompt, userPrompt, options = {}) {
  const GROQ_API_KEY = getGroqApiKey();
  if (!GROQ_API_KEY) {
    throw new Error('Missing GROQ_API_KEY');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: options.maxTokens ?? 1024,
      temperature: 0.3,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Groq API Error: ${body}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

/** Re-export for routes that used inline fetch — same behavior as legacy ai.js */
export { getGeminiKey, getHfApiKey, getModel };
