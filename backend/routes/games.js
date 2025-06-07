// routes/games.js
import express from "express";
import db from "../db.js";

const router = express.Router();

router.get("/:league/games", async (req, res) => {
  const { league } = req.params;
  const { teamId } = req.query;

  try {
    let query = `
      SELECT 
        g.*,
  th.name AS home_team_name,
  th.shortname AS home_shortname,
  th.logo_url AS home_logo,
  ta.name AS away_team_name,
  ta.shortname AS away_shortname,
=  ta.logo_url AS away_logo
      FROM games g
      JOIN teams th ON g.hometeamid = th.id
      JOIN teams ta ON g.awayteamid = ta.id
      WHERE g.league = $1
    `;

    const params = [league];

    // Add team filter if teamId exists
    if (teamId) {
      query += ` AND ($2::integer IN (g.hometeamid, g.awayteamid))`;
      params.push(teamId);
    }

    query += ` ORDER BY g.date DESC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching games:", err);
    res.status(500).json({ error: "Failed to fetch games." });
  }
});

export default router;