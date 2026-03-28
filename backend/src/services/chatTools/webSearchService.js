import logger from "../../logger.js";

const TAVILY_URL = "https://api.tavily.com/search";

export async function webSearch(query) {
  const apiKey = process.env.TAVILY_SECRET_KEY || process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return { error: "Web search not configured" };
  }

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
        topic: "news",
        days: 180,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
    const data = await res.json();

    return {
      _dataSource: "external-web",
      answer: data.answer || null,
      results: (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: (r.content || "").slice(0, 400),
        publishedDate: r.published_date || null,
      })),
    };
  } catch (err) {
    logger.error({ err }, "Tavily search failed");
    return { error: "Web search temporarily unavailable" };
  }
}
