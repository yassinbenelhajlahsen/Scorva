import express from "express";
import { streamGames, streamGame } from "../../controllers/games/liveController.js";

const router = express.Router();
router.get("/live/:league/games", streamGames);
router.get("/live/:league/games/:gameId", streamGame);
export default router;
