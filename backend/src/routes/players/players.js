import express from "express";
import { getPlayers } from "../../controllers/players/playersController.js";

const router = express.Router();

router.get("/:league/players", getPlayers);

export default router;
