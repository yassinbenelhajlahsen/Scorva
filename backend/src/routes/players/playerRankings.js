import express from "express";
import { getPlayerRankings } from "../../controllers/players/playerRankingsController.js";

const router = express.Router();

router.get("/:league/players/:slug/rankings", getPlayerRankings);

export default router;
