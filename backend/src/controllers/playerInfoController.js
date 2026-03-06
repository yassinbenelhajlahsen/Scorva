import { getPlayerIdBySlug } from "../utils/slugResolver.js";
import { getNbaPlayer, getNflPlayer, getNhlPlayer } from "../services/playerInfoService.js";

const currentSeason = "2025-26";

const leagueHandlers = {
  nba: getNbaPlayer,
  nfl: getNflPlayer,
  nhl: getNhlPlayer,
};

export async function getPlayerInfo(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const { slug } = req.params;
  const season = req.query.season || currentSeason;

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
    console.error(`Error fetching ${league.toUpperCase()} player:`, err);
    return res.status(500).json({ error: "Server error" });
  }
}
