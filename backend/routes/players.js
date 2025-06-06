import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/:league/players', async (req, res) => {
  const { league } = req.params;

  try {
    const result = await pool.query(`
      SELECT *
      FROM players
      WHERE league = $1
      ORDER BY position;
    `, [league]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching players:", err);
    res.status(500).send("Server error");
  }
});

export default router;
