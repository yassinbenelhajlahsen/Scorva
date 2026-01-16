import express from "express";
import db from "../db/db.js";

const router = express.Router();

const TYPE_PRIORITY = { player: 2, team: 1, game: 3 };

function scoreMatch(name, rawTerm) {
  const lower = name.toLowerCase();
  if (lower === rawTerm) return 0;
  if (lower.startsWith(rawTerm)) return 1;
  if (lower.includes(rawTerm)) return 2;
  return 3;
}

router.get("/search", async (req, res) => {
  const { term } = req.query;
  if (!term || term.trim().length === 0) {
    return res.json([]);
  }

  const sanitizedTerm = term.trim();
  const q = `%${sanitizedTerm}%`;
  const rawTerm = sanitizedTerm.toLowerCase();

  try {
    // Use a single query with UNION ALL for better performance
    const result = await db.query(
      `
      (
        SELECT id, name, league, image_url AS "imageUrl", NULL AS shortname, 'player' AS type
        FROM players
        WHERE name ILIKE $1
        LIMIT 10
      )
      UNION ALL
      (
        SELECT id, name, league, logo_url AS "imageUrl", shortname, 'team' AS type
        FROM teams
        WHERE name ILIKE $1 OR shortname ILIKE $1
        LIMIT 10
      )
      UNION ALL
      (
        SELECT g.id, 
               CONCAT(ht.shortname, ' vs ', at.shortname) AS name,
               g.league,
               NULL AS "imageUrl",
               NULL AS shortname,
               'game' AS type
        FROM games g
        JOIN teams ht ON g.hometeamid = ht.id
        JOIN teams at ON g.awayteamid = at.id
        WHERE ht.name ILIKE $1 OR at.name ILIKE $1 OR ht.shortname ILIKE $1 OR at.shortname ILIKE $1
        LIMIT 10
      )
      `,
      [q]
    );

    let results = result.rows;

    // Sort results by relevance
    results.sort((a, b) => {
      const aText = (a.shortname ?? a.name).toLowerCase();
      const bText = (b.shortname ?? b.name).toLowerCase();

      const ma = scoreMatch(aText, rawTerm);
      const mb = scoreMatch(bText, rawTerm);
      if (ma !== mb) return ma - mb;

      const ta = TYPE_PRIORITY[a.type];
      const tb = TYPE_PRIORITY[b.type];
      if (ta !== tb) return tb - ta;

      return aText.localeCompare(bText);
    });

    // Limit to top 15 results
    res.json(results.slice(0, 15));
  } catch (error) {
    console.error("Error in /search:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
