import { Router } from "express";
import { topPerformances } from "../../controllers/games/topPerformancesController.js";

const router = Router();
router.get("/:league/top-performances", topPerformances);
export default router;
