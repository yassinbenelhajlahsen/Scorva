import express from "express";
import { getGamePlays } from "../../controllers/games/playsController.js";

const router = express.Router();

router.get("/:league/games/:gameId/plays", getGamePlays);

export default router;
