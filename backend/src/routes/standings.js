import express from "express";
import { getStandingsList } from "../controllers/standingsController.js";

const router = express.Router();

router.get("/:league/standings", getStandingsList);

export default router;
