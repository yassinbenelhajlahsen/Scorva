import { getActiveStreak } from "../../services/streaks/streaksService.js";
import { getPlayerIdBySlug } from "../../utils/slugResolver.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getPlayerStreak(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) {
    return res.status(400).json({ error: "Invalid league" });
  }
  try {
    const playerId = await getPlayerIdBySlug(req.params.slug, league);
    if (!playerId) return res.status(404).json({ error: "Player not found" });
    const streak = await getActiveStreak(league, "player", playerId);
    return res.json({ streak });
  } catch (err) {
    logger.error({ err, league }, "Error fetching player streak");
    return res.status(500).json({ error: "Server error" });
  }
}

export async function getTeamStreak(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const teamId = parseInt(req.params.teamId, 10);
  if (!VALID_LEAGUES.includes(league)) {
    return res.status(400).json({ error: "Invalid league" });
  }
  if (!Number.isInteger(teamId)) {
    return res.status(400).json({ error: "Invalid team ID" });
  }
  try {
    const streak = await getActiveStreak(league, "team", teamId);
    return res.json({ streak });
  } catch (err) {
    logger.error({ err, league }, "Error fetching team streak");
    return res.status(500).json({ error: "Server error" });
  }
}
