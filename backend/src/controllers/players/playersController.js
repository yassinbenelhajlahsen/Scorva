import { getPlayersByLeague } from "../../services/players/playersService.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getPlayers(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });

  try {
    const players = await getPlayersByLeague(league);
    res.json(players);
  } catch (err) {
    logger.error({ err }, "Error fetching players");
    res.status(500).send("Server error");
  }
}
