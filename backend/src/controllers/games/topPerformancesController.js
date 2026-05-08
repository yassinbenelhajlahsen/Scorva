import { getTopPerformances } from "../../services/games/topPerformancesService.js";

export async function topPerformances(req, res, next) {
  try {
    const { league } = req.params;
    if (league !== "nba") {
      return res.status(400).json({ error: "top-performances supports nba only in v1" });
    }
    const { days, type, limit } = req.query;
    const data = await getTopPerformances({ league, days, type, limit });
    res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}
