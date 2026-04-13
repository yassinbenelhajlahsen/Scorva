import express from "express";
import { getGamesList } from "../../controllers/games/gamesController.js";
import { getGameDatesList } from "../../controllers/games/gameDatesController.js";

const router = express.Router();

// Must be before /:league/games to avoid :gameId catching "dates" in gameDetail.js
router.get("/:league/games/dates", getGameDatesList);
router.get("/:league/games", getGamesList);

export default router;
