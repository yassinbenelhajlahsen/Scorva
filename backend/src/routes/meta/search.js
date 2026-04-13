import express from "express";
import { searchAll } from "../../controllers/meta/searchController.js";

const router = express.Router();

router.get("/search", searchAll);

export default router;
