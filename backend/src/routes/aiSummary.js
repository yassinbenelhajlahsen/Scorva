import express from "express";
import { getAiSummary } from "../controllers/aiSummaryController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/games/:id/ai-summary", requireAuth, getAiSummary);

export default router;
