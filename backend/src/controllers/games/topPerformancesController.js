import { getTopPerformances } from "../../services/games/topPerformancesService.js";

export async function topPerformances(req, res, next) {
  try {
    if (req.params.league !== "nba") {
      return res.status(400).json({ error: "top-performances supports nba only in v1" });
    }
    const { type, window, sort, position, limit, days, playerId, teamId, entity, fallback, season } = req.query;
    const parsedTeamId = teamId != null && teamId !== "" ? parseInt(teamId, 10) : undefined;
    const out = await getTopPerformances({
      league: req.params.league,
      type, window, sort, position, limit, days, playerId, entity,
      season: season || undefined,
      teamId: Number.isNaN(parsedTeamId) ? undefined : parsedTeamId,
      fallback: fallback === "true",
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}
