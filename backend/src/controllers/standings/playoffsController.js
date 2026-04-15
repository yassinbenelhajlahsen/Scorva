import { getNbaPlayoffs } from "../../services/standings/playoffsService.js";
import { getNhlPlayoffs } from "../../services/standings/nhlPlayoffsService.js";
import logger from "../../logger.js";

export async function getPlayoffsBracket(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (league !== "nba" && league !== "nhl") {
    return res
      .status(400)
      .json({ error: "Playoffs bracket is only available for NBA and NHL" });
  }
  const { season } = req.query;

  try {
    if (league === "nba") {
      res.json(await getNbaPlayoffs(season));
    } else {
      res.json(await getNhlPlayoffs(season));
    }
  } catch (err) {
    logger.error({ err }, "Error fetching playoffs bracket");
    res.status(500).json({ error: "Failed to fetch playoffs" });
  }
}
