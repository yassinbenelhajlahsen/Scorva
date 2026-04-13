import express from "express";
import { getSeasonsList } from "../../controllers/meta/seasonsController.js";

const router = express.Router();

router.get("/:league/seasons", getSeasonsList);

export default router;
