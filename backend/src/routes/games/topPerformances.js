import { Router } from "express";
import { topPerformances } from "../../controllers/games/topPerformancesController.js";

const router = Router({ mergeParams: true });
router.get("/top-performances", topPerformances);
export default router;
