import express from "express";
import { getPlayoffsBracket } from "../controllers/playoffsController.js";

const router = express.Router();

router.get("/:league/playoffs", getPlayoffsBracket);

export default router;
