import express from "express";
import { getPlayerInfo } from "../controllers/playerInfoController.js";

const router = express.Router();

router.get("/:league/players/:slug", getPlayerInfo);

export default router;
