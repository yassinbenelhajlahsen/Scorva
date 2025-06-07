import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/:league/games', async (req, res) => {
  const leagueParam = req.params.league.toLowerCase();

  try {
    const { rows } = await pool.query(
      `
      SELECT
        g.id,
        g.date,
        g.status,
        g.homescore,
        g.awayscore,
        g.*,
  th.name AS home_team_name,
  th.shortname AS home_shortname,
  th.location AS home_location,
  th.logo_url AS home_logo,
  ta.name AS away_team_name,
  ta.shortname AS away_shortname,
  ta.location AS away_location,
  ta.logo_url AS away_logo
      FROM games g
      JOIN teams th
        ON g.hometeamid = th.id
      JOIN teams ta
        ON g.awayteamid = ta.id
      WHERE lower(g.league) = $1
      ORDER BY g.date DESC
      LIMIT 16;
      `,
      [leagueParam]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).send('Server error');
  }
});

export default router;
