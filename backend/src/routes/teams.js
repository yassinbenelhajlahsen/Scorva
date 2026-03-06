import express from "express";
import { getTeams } from "../controllers/teamsController.js";

const router = express.Router();

router.get("/:league/teams", getTeams);

export default router;
