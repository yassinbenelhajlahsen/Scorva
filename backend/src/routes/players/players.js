import express from "express";
import { getPlayers, getDuplicateSlugs } from "../../controllers/players/playersController.js";

const router = express.Router();

router.get("/:league/players", getPlayers);
router.get("/:league/players/duplicate-slugs", getDuplicateSlugs);

export default router;
