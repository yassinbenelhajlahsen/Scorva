import express from "express";
import db from "../db.js";

const router = express.Router();

router.get("/:league/games", async (req, res) => {
  const { league } = req.params;
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Missing teamId in query." });
  }

  try {
    const { rows } = await db.query(
      `
     SELECT 
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
JOIN teams th ON g.hometeamid = th.id
JOIN teams ta ON g.awayteamid = ta.id
WHERE g.league = $1
  AND ($2 IN (g.hometeamid, g.awayteamid))
ORDER BY g.id DESC;

      `,
      [league, teamId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching games:", err);
    res.status(500).json({ error: "Failed to fetch games." });
  }
});

export default router;
