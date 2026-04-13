import express from "express";
import { streamChat } from "../../controllers/ai/chatController.js";
import { requireAuth } from "../../middleware/auth.js";
import { chatLimiter } from "../../middleware/index.js";

const router = express.Router();

router.post("/chat", chatLimiter, requireAuth, streamChat);

export default router;
