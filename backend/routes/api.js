import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/players", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM players");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching players:", err.message);
    res.status(500).send("Server error");
  }
});

export default router;

