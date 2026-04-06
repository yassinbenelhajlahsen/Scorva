import express from "express";
import { getGamePrediction } from "../controllers/predictionController.js";

const router = express.Router();
router.get("/:league/games/:gameId/prediction", getGamePrediction);
export default router;
