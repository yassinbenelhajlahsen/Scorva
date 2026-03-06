import express from "express";
import { handleSupabaseAuth } from "../controllers/webhooksController.js";

const router = express.Router();

router.post("/webhooks/supabase-auth", handleSupabaseAuth);

export default router;
