import { search } from "../../services/meta/searchService.js";
import logger from "../../logger.js";

export async function searchAll(req, res) {
  const { term } = req.query;

  if (!term || term.trim().length === 0) {
    return res.json([]);
  }

  try {
    const results = await search(term);
    res.json(results);
  } catch (error) {
    logger.error({ err: error }, "Error in /search");
    res.status(500).json({ error: "Internal server error" });
  }
}
