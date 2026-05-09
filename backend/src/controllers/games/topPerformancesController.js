import { getTopPerformances } from "../../services/games/topPerformancesService.js";

export async function topPerformances(req, res, next) {
  try {
    if (req.params.league !== "nba") {
      return res.status(400).json({ error: "top-performances supports nba only in v1" });
    }
    const { type, window, sort, position, limit, days } = req.query;
    const out = await getTopPerformances({
      league: req.params.league,
      type, window, sort, position, limit, days,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}
