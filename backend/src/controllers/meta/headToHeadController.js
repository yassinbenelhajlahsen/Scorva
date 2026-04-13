import { getHeadToHead } from "../../services/meta/headToHeadService.js";
import logger from "../../logger.js";

const VALID_LEAGUES = new Set(["nba", "nfl", "nhl"]);
const VALID_TYPES = new Set(["players", "teams"]);

export async function headToHead(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.has(league)) {
    return res.status(400).json({ error: "Invalid league" });
  }

  const type = req.query.type;
  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: "type must be 'players' or 'teams'" });
  }

  const ids = (req.query.ids || "").split(",").map(Number).filter(Boolean);
  if (ids.length !== 2) {
    return res.status(400).json({ error: "ids must contain exactly 2 numeric IDs" });
  }

  try {
    const games = await getHeadToHead(league, type, ids[0], ids[1]);
    return res.json({ games });
  } catch (err) {
    logger.error({ err, league, type, ids }, "Error fetching head-to-head");
    return res.status(500).json({ error: "Server error" });
  }
}
