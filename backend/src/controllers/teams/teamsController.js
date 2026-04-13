import { getTeamsByLeague, getTeamAvailableSeasons } from "../../services/teams/teamsService.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getTeamSeasons(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const teamId = parseInt(req.params.teamId, 10);
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });
  if (!Number.isInteger(teamId)) return res.status(400).json({ error: "Invalid team ID" });

  try {
    const seasons = await getTeamAvailableSeasons(league, teamId);
    res.json(seasons);
  } catch (err) {
    logger.error({ err }, "Error fetching team seasons");
    res.status(500).send("Server error");
  }
}

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
