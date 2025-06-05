import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/:league/teams', async (req, res) => {
  const { league } = req.params;

  try {
    const result = await pool.query(`
      SELECT *
      FROM teams
      WHERE league = $1
      ORDER BY conf, name
    `, [league]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching teams:", err);
    res.status(500).send("Server error");
  }
});

export default router;
