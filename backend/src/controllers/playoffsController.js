import { getNbaPlayoffs } from "../services/playoffsService.js";
import logger from "../logger.js";

export async function getPlayoffsBracket(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (league !== "nba") {
    return res.status(400).json({ error: "Playoffs bracket is only available for NBA" });
  }
  const { season } = req.query;

  try {
    const data = await getNbaPlayoffs(season);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Error fetching playoffs bracket");
    res.status(500).json({ error: "Failed to fetch playoffs" });
  }
}
