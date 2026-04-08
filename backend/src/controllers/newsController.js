import { getNews } from "../services/newsService.js";
import logger from "../logger.js";

export async function getNewsList(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 10);
    const articles = await getNews();
    res.json({ articles: articles.slice(0, limit) });
  } catch (err) {
    logger.error({ err }, "news fetch failed");
    res.status(500).json({ error: "Failed to fetch news." });
  }
}
