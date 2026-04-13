import { getPrediction } from "../../services/games/predictionService.js";
import logger from "../../logger.js";

export async function getGamePrediction(req, res) {
  const { league, gameId } = req.params;

  if (!["nba", "nfl", "nhl"].includes(league.toLowerCase())) {
    return res.status(400).send("Invalid league");
  }
  if (Number.isNaN(parseInt(gameId, 10))) {
    return res.status(400).send("Invalid game ID");
  }

  try {
    const prediction = await getPrediction(league.toLowerCase(), parseInt(gameId, 10));
    if (!prediction) {
      return res.status(404).send("No prediction available");
    }
    return res.json(prediction);
  } catch (err) {
    logger.error({ err, league, gameId }, "prediction fetch error");
    return res.status(500).send("Server error");
  }
}
