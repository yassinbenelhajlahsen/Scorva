import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/:league/standings', async (req, res) => {
  const { league } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        shortname,
        location,
        conf,
        logo_url,
        split_part(record, '-', 1)::int AS wins,
        split_part(record, '-', 2)::int AS losses
      FROM teams
      WHERE league = $1
      ORDER BY conf, wins DESC, losses ASC
    `, [league]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching standings:", err);
    res.status(500).send("Failed to fetch standings");
  }
});

export default router;
