import { getNbaGame, getNflGame, getNhlGame } from "../services/gameInfoService.js";
import logger from "../logger.js";

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
