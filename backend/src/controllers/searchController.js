import { search } from "../services/searchService.js";

export async function searchAll(req, res) {
  const { term } = req.query;

  if (!term || term.trim().length === 0) {
    return res.json([]);
  }

  try {
    const results = await search(term);
    res.json(results);
  } catch (error) {
    console.error("Error in /search:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
