import express from "express";
import { headToHead } from "../../controllers/meta/headToHeadController.js";

const router = express.Router();

router.get("/:league/head-to-head", headToHead);

export default router;
