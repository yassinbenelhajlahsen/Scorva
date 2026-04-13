import { getPlays } from "../../services/games/playsService.js";
import logger from "../../logger.js";

const VALID_LEAGUES = new Set(["nba", "nfl", "nhl"]);

export async function getGamePlays(req, res) {
  const { league, gameId } = req.params;

  if (!VALID_LEAGUES.has(league.toLowerCase())) {
    return res.status(400).send("Invalid league");
  }

  if (Number.isNaN(parseInt(gameId, 10))) {
    return res.status(400).send("Invalid game ID");
  }

  try {
    const data = await getPlays(parseInt(gameId, 10), league.toLowerCase());
    if (!data) {
      return res.status(404).send("Game not found");
    }
    return res.json(data);
  } catch (err) {
    logger.error({ err, league, gameId }, "plays fetch error");
    return res.status(500).send("Server error");
  }
}
