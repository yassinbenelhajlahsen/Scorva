import express from "express";
import {
  getPlayerStreak,
  getTeamStreak,
} from "../../controllers/streaks/streaksController.js";

const router = express.Router();

router.get("/:league/players/:slug/streak", getPlayerStreak);
router.get("/:league/teams/:teamId/streak", getTeamStreak);

export default router;
