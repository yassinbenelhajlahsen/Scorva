import { getGameDates } from "../../services/games/gamesService.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getGameDatesList(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) {
    return res.status(400).json({ error: "Invalid league" });
  }
  try {
    const season = req.query.season ? String(req.query.season) : undefined;
    const dates = await getGameDates(league, season);
    res.json(dates);
  } catch (err) {
    logger.error({ err }, "Error fetching game dates");
    res.status(500).json({ error: "Failed to fetch game dates." });
  }
}
