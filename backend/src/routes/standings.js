import express from "express";
import pool from "../db/db.js";

const router = express.Router();

router.get("/:league/standings", async (req, res) => {
  const { league } = req.params;
  const { season } = req.query;

  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.shortname, t.location, t.conf, t.logo_url,
        COUNT(*) FILTER (WHERE g.winnerid = t.id) AS wins,
        COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id) AS losses
      FROM teams t
      LEFT JOIN games g ON (g.hometeamid = t.id OR g.awayteamid = t.id)
        AND g.league = $1
        AND g.season = COALESCE($2, (
          SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL
        ))
        AND g.status ILIKE 'Final%'
        AND g.game_label IS NULL
      WHERE t.league = $1
      GROUP BY t.id, t.name, t.shortname, t.location, t.conf, t.logo_url
      ORDER BY t.conf, wins DESC, losses ASC`,
      [league, season || null]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching standings:", err);
    res.status(500).send("Failed to fetch standings");
  }
});

export default router;
