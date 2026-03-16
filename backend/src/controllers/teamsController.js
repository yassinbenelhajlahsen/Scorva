import { getTeamsByLeague } from "../services/teamsService.js";
import logger from "../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getTeams(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });

  try {
    const teams = await getTeamsByLeague(league);
    res.json(teams);
  } catch (err) {
    logger.error({ err }, "Error fetching teams");
    res.status(500).send("Server error");
  }
}
