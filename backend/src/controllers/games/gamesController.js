import { getGames } from "../../services/games/gamesService.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getGamesList(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });
  const { teamId, season, date } = req.query;

  if (teamId !== undefined && Number.isNaN(parseInt(teamId, 10))) {
    return res.status(400).json({ error: "Invalid team ID" });
  }

  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
  }

  try {
    const result = await getGames(league, { teamId, season, date });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error fetching games");
    res.status(500).json({ error: "Failed to fetch games." });
  }
}
