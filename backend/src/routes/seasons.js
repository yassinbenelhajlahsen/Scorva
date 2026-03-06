import express from "express";
import pool from "../db/db.js";

const router = express.Router();

router.get("/:league/seasons", async (req, res) => {
  const { league } = req.params;
  try {
    const result = await pool.query(
      `SELECT DISTINCT season FROM games WHERE league = $1 AND season IS NOT NULL ORDER BY season DESC LIMIT 3`,
      [league]
    );
    res.json(result.rows.map((r) => r.season));
  } catch (err) {
    console.error("Error fetching seasons:", err);
    res.status(500).json({ error: "Failed to fetch seasons" });
  }
});

export default router;
