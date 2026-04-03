import express from "express";
import { getPlayerInfo } from "../controllers/playerDetailController.js";

const router = express.Router();

router.get("/:league/players/:slug", getPlayerInfo);

export default router;
