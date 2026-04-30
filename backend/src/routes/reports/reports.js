import { Router } from "express";
import { getReports } from "../../controllers/reports/reportsController.js";

const router = Router();

router.get("/reports", getReports);

export default router;
