import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/:league/games", async (req, res) => {
  const { league } = req.params;
  const { teamId, season } = req.query;

  try {
    const currentSeasonSubquery = `(SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL)`;

    let query = `
      SELECT
        g.*,
  th.name AS home_team_name,
  th.shortname AS home_shortname,
  th.logo_url AS home_logo,
  ta.name AS away_team_name,
  ta.shortname AS away_shortname,
  ta.logo_url AS away_logo
      FROM games g
      JOIN teams th ON g.hometeamid = th.id
      JOIN teams ta ON g.awayteamid = ta.id
      WHERE g.league = $1
        AND g.season = COALESCE($2, ${currentSeasonSubquery})
    `;

    const params = [league, season || null];

    // Add team filter if teamId exists to search just THAT team's games
    if (teamId) {
      query += ` AND ($${params.length + 1}::integer IN (g.hometeamid, g.awayteamid))`;
      params.push(teamId);
    }

    query += ` ORDER BY g.date DESC`;

    // League page: limit to 12 most recent games; team page: full season schedule
    if (!teamId) {
      query += ` LIMIT 12`;
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching games:", err);
    res.status(500).json({ error: "Failed to fetch games." });
  }
});

export default router;
