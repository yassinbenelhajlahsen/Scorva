import express from "express";
import { getGamePlays } from "../controllers/playsController.js";

const router = express.Router();

router.get("/:league/games/:gameId/plays", getGamePlays);

export default router;
