import { getPlayerIdBySlug } from "../../utils/slugResolver.js";
import logger from "../../logger.js";
import { getNbaPlayerRankings } from "../../services/players/playerRankingsService.js";

export async function getPlayerRankings(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const { slug } = req.params;

  if (league !== "nba") {
    return res.json({ rankings: null });
  }

  try {
    const playerId = await getPlayerIdBySlug(slug, league);
    if (!playerId) {
      return res.status(404).json({ error: "Player not found" });
    }
    const rankings = await getNbaPlayerRankings(playerId);
    return res.json({ rankings });
  } catch (err) {
    logger.error({ err, league, slug }, "Error fetching player rankings");
    return res.status(500).json({ error: "Server error" });
  }
}
