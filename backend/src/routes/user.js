import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/userController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/user/profile", ctrl.getProfile);
router.patch("/user/profile", ctrl.updateProfile);
router.delete("/user/account", ctrl.deleteAccount);

export default router;
