import { getNbaPlayoffs } from "../../services/standings/playoffsService.js";
import { getNhlPlayoffs } from "../../services/standings/nhlPlayoffsService.js";
import { getNflPlayoffs } from "../../services/standings/nflPlayoffsService.js";
import logger from "../../logger.js";

export async function getPlayoffsBracket(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (league !== "nba" && league !== "nhl" && league !== "nfl") {
    return res
      .status(400)
      .json({ error: "Playoffs bracket is only available for NBA, NHL, and NFL" });
  }
  const { season } = req.query;

  try {
    if (league === "nba") {
      res.json(await getNbaPlayoffs(season));
    } else if (league === "nhl") {
      res.json(await getNhlPlayoffs(season));
    } else {
      res.json(await getNflPlayoffs(season));
    }
  } catch (err) {
    logger.error({ err }, "Error fetching playoffs bracket");
    res.status(500).json({ error: "Failed to fetch playoffs" });
  }
}
