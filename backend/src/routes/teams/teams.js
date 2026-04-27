import express from "express";
import {
  getTeams,
  getTeamSeasons,
  getTeamRoster,
} from "../../controllers/teams/teamsController.js";

const router = express.Router();

router.get("/:league/teams/:teamId/roster", getTeamRoster);
router.get("/:league/teams/:teamId/seasons", getTeamSeasons);
router.get("/:league/teams", getTeams);

export default router;
