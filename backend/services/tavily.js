/**
 * Tavily search for recruiter-facing role intelligence (optional; requires TAVILY_API_KEY).
 */

async function readErrorBody(response) {
  try {
    const data = await response.json();
    return data?.detail || data?.message || JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }
}

export async function tavilySearch(query, options = {}) {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      error: 'TAVILY_API_KEY not set',
      results: [],
    };
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: options.searchDepth || 'basic',
      max_results: options.maxResults ?? 6,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    return { ok: false, error: body, results: [] };
  }

  const data = await response.json();
  return {
    ok: true,
    answer: data.answer || '',
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    })),
  };
}
