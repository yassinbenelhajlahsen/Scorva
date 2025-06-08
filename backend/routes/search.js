import express from "express";
import db from "../db.js";

const router = express.Router();

const TYPE_PRIORITY = { player: 2, team: 1, game: 3 };

function scoreMatch(name, rawTerm) {
  const lower = name.toLowerCase();
  if (lower === rawTerm) return 0;
  if (lower.startsWith(rawTerm)) return 1;
  if (lower.includes(rawTerm)) return 2;
  return 3;
}

router.get('/search', async (req, res) => {
  const { term } = req.query;
  if (!term) return res.json([]);
  const q = `%${term}%`;
  const rawTerm = term.toLowerCase();

  try {
    const [players, teams, games] = await Promise.all([
      db.query(
        `SELECT id, name, league, image_url AS "imageUrl"
         FROM players
         WHERE name ILIKE $1
         LIMIT 10`,
        [q]
      ),
      db.query(
        `SELECT id, name, league, shortname, logo_url AS "imageUrl"
         FROM teams
         WHERE name ILIKE $1
         LIMIT 10`,
        [q]
      ),
      db.query(
        `SELECT g.id, g.league,
                CONCAT(ht.shortname, ' vs ', at.shortname) AS name
         FROM games g
         JOIN teams ht ON g.hometeamid = ht.id
         JOIN teams at ON g.awayteamid = at.id
         WHERE ht.name ILIKE $1 OR at.name ILIKE $1
         LIMIT 10`,
        [q]
      )
    ]);

    let results = [
      ...players.rows.map(r => ({ ...r, type: 'player' })),
      ...teams.rows.map(r => ({ ...r, type: 'team' })),
      ...games.rows.map(r => ({ ...r, imageUrl: null, type: 'game' }))
    ];

    results.sort((a, b) => {
  const aText = (a.shortname ?? a.name).toLowerCase();
  const bText = (b.shortname ?? b.name).toLowerCase();

  const ma = scoreMatch(aText, rawTerm);
  const mb = scoreMatch(bText, rawTerm);
  if (ma !== mb) return ma - mb;

  const ta = TYPE_PRIORITY[a.type];
  const tb = TYPE_PRIORITY[b.type];
  if (ta !== tb) return ta - tb;

  return aText.localeCompare(bText);
});

    res.json(results);
  } catch (error) {
    console.error('Error in /search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
