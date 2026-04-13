import { getPlayerIdBySlug } from "../../utils/slugResolver.js";
import logger from "../../logger.js";
import { getNbaPlayer, getNflPlayer, getNhlPlayer } from "../../services/players/playerDetailService.js";
import { getCurrentSeason } from "../../cache/seasons.js";

const leagueHandlers = {
  nba: getNbaPlayer,
  nfl: getNflPlayer,
  nhl: getNhlPlayer,
};

export async function getPlayerInfo(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const { slug } = req.params;
  const season = req.query.season || await getCurrentSeason(league);

  const handler = leagueHandlers[league];
  if (!handler) {
    return res.status(400).json({ error: "Invalid league" });
  }

  try {
    const playerId = await getPlayerIdBySlug(slug, league);
    if (!playerId) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = await handler(playerId, season);
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    return res.json(player);
  } catch (err) {
    logger.error({ err, league }, "Error fetching player");
    return res.status(500).json({ error: "Server error" });
  }
}
