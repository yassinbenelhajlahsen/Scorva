import express from "express";
import { getSimilar } from "../controllers/similarPlayersController.js";

const router = express.Router();

router.get("/:league/players/:slug/similar", getSimilar);

export default router;
