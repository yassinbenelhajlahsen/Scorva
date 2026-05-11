import logger from "../../logger.js";
import { getNbaTeamRankings } from "../../services/teams/teamRankingsService.js";

export async function getTeamRankings(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const teamId = Number.parseInt(req.params.teamId, 10);

  if (league !== "nba") {
    return res.json({ rankings: null });
  }
  if (!Number.isFinite(teamId)) {
    return res.status(400).json({ error: "Invalid teamId" });
  }

  try {
    const rankings = await getNbaTeamRankings(teamId);
    return res.json({ rankings });
  } catch (err) {
    logger.error({ err, league, teamId }, "Error fetching team rankings");
    return res.status(500).json({ error: "Server error" });
  }
}
