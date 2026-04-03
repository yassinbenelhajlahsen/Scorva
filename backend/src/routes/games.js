import express from "express";
import { getGamesList } from "../controllers/gamesController.js";
import { getGameDatesList } from "../controllers/gameDatesController.js";

const router = express.Router();

// Must be before /:league/games to avoid :gameId catching "dates" in gameDetail.js
router.get("/:league/games/dates", getGameDatesList);
router.get("/:league/games", getGamesList);

export default router;
