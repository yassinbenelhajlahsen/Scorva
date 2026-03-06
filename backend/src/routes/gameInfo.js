import express from "express";
import { getGameInfo } from "../controllers/gameInfoController.js";

const router = express.Router();

router.get("/:league/games/:gameId", getGameInfo);

export default router;
