import express from "express";
import { getAiSummary } from "../controllers/aiSummaryController.js";
import { requireAuth } from "../middleware/auth.js";
import { aiLimiter } from "../middleware/index.js";

const router = express.Router();

router.get("/games/:id/ai-summary", aiLimiter, requireAuth, getAiSummary);

export default router;
