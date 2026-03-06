import express from "express";
import { getGamesList } from "../controllers/gamesController.js";

const router = express.Router();

router.get("/:league/games", getGamesList);

export default router;
