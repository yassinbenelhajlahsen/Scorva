import express from "express";
import db from "../db.js";

const router = express.Router();

router.get("/:league/games", async (req, res) => {
  const { league } = req.params;
  const { teamId } = req.query;

  // Log inputs for debugging
  console.log("Fetching games for league:", league, "teamId:", teamId);

  try {
    const { rows } = await db.query(
      `
      SELECT 
        g.*,
        th.name AS home_team_name,
        th.shortname AS home_shortname,
        ta.name AS away_team_name,
        ta.shortname AS away_shortname
      FROM games g
      JOIN teams th ON g.hometeamid = th.id
      JOIN teams ta ON g.awayteamid = ta.id
      WHERE g.league = $1
        AND ($2::integer IN (g.hometeamid, g.awayteamid))
      ORDER BY g.date DESC
      LIMIT 10;  // Optional: Limit to last 10 games
      `,
      [league, teamId]
    );

    console.log("Fetched games:", rows.length); // Debug row count
    res.json(rows);
  } catch (err) {
    console.error("Error fetching games:", err);
    res.status(500).json({ error: "Failed to fetch games." });
  }
});

export default router;
