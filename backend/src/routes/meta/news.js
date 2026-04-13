import { Router } from "express";
import { getNewsList } from "../../controllers/meta/newsController.js";

const router = Router();

router.get("/news", getNewsList);

export default router;
