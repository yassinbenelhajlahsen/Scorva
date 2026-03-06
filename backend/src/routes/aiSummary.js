import express from "express";
import { getAiSummary } from "../controllers/aiSummaryController.js";

const router = express.Router();

router.get("/games/:id/ai-summary", getAiSummary);

export default router;
