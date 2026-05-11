import express from "express";
import {
  getTeams,
  getTeamSeasons,
  getTeamRoster,
  getTeamNextGame,
} from "../../controllers/teams/teamsController.js";
import { getTeamRankings } from "../../controllers/teams/teamRankingsController.js";

const router = express.Router();

router.get("/:league/teams/:teamId/roster", getTeamRoster);
router.get("/:league/teams/:teamId/seasons", getTeamSeasons);
router.get("/:league/teams/:teamId/next-game", getTeamNextGame);
router.get("/:league/teams/:teamId/rankings", getTeamRankings);
router.get("/:league/teams", getTeams);

export default router;
