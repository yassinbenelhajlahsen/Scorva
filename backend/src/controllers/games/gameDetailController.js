import { getNbaGame, getNflGame, getNhlGame } from "../../services/games/gameDetailService.js";
import { getWinProbability as fetchWinProbability } from "../../services/games/winProbabilityService.js";
import logger from "../../logger.js";

const leagueHandlers = {
  nba: getNbaGame,
  nfl: getNflGame,
  nhl: getNhlGame,
};

export async function getGameInfo(req, res) {
  const { league, gameId } = req.params;
  const handler = leagueHandlers[league.toLowerCase()];

  if (!handler) {
    return res.status(400).send("Invalid league");
  }

  if (Number.isNaN(parseInt(gameId, 10))) {
    return res.status(400).send("Invalid game ID");
  }

  try {
    const game = await handler(gameId);
    if (!game) {
      return res.status(404).send("Game not found");
    }
    return res.json(game);
  } catch (err) {
    logger.error({ err, league }, "game fetch error");
    return res.status(500).send("Server error");
  }
}

const VALID_LEAGUES = new Set(["nba", "nfl", "nhl"]);

export async function getWinProbability(req, res) {
  const { league, eventId } = req.params;

  if (!VALID_LEAGUES.has(league.toLowerCase())) {
    return res.status(400).send("Invalid league");
  }

  if (Number.isNaN(parseInt(eventId, 10))) {
    return res.status(400).send("Invalid event ID");
  }

  const isFinal = req.query.final === "true";

  try {
    const data = await fetchWinProbability(league.toLowerCase(), eventId, isFinal);
    return res.json({ data });
  } catch (err) {
    logger.error({ err, league, eventId }, "win probability fetch error");
    return res.status(500).send("Server error");
  }
}
