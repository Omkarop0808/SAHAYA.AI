/**
 * Career World AI routing: Groq for realtime conversation; Gemini-only for structured doc/JSON tasks.
 * No Anthropic/Claude in production paths (see gemini.js callDeepReason).
 */

function getGroqKey() {
  return process.env.GROQ_API_KEY || '';
}

function getGroqModel() {
  return process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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
export async function callGroqChat(systemPrompt, userPrompt, options = {}) {
  const key = getGroqKey();
  if (!key) throw new Error('Missing GROQ_API_KEY for conversational AI');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: options.maxTokens ?? 1024,
      temperature: 0.35,
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

function safeParseJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/** Gemini only (no Groq) — document understanding + strict JSON. */
export async function callGeminiStructuredJSON(systemPrompt, userPrompt, maxTokens = 2048) {
  const key = getGeminiKey();
  if (!key) throw new Error('Missing GEMINI_API_KEY for structured analysis');

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.25,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Gemini API Error: ${body}`);
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  const parsed = safeParseJSON(raw);
  if (parsed) return parsed;

  const repair = await callGroqChat(
    'You output only valid JSON. No markdown.',
    `Fix to valid JSON only:\n${raw}`,
    { maxTokens: 1200, jsonMode: true },
  ).catch(() => null);

  const again = repair ? safeParseJSON(repair) : null;
  if (again) return again;
  throw new Error('Gemini returned non-JSON output.');
}

/** Plain text from Gemini (resume extraction, long-form parsing). */
export async function callGeminiText(systemPrompt, userPrompt, maxTokens = 4096) {
  const key = getGeminiKey();
  if (!key) throw new Error('Missing GEMINI_API_KEY');

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Gemini API Error: ${body}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
}
