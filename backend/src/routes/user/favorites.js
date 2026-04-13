import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as ctrl from "../../controllers/user/favoritesController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/favorites", ctrl.getFavorites);
router.get("/favorites/check", ctrl.checkFavorites);
router.post("/favorites/players/:playerId", ctrl.addFavoritePlayer);
router.delete("/favorites/players/:playerId", ctrl.removeFavoritePlayer);
router.post("/favorites/teams/:teamId", ctrl.addFavoriteTeam);
router.delete("/favorites/teams/:teamId", ctrl.removeFavoriteTeam);

export default router;
