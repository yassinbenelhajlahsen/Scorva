import express from "express";
import { getGameInfo, getWinProbability } from "../controllers/gameDetailController.js";

const router = express.Router();

router.get("/:league/games/:eventId/win-probability", getWinProbability);
router.get("/:league/games/:gameId", getGameInfo);

export default router;
