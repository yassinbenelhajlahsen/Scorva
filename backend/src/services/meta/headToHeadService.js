import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";

const TTL_30D = 30 * 86400;

export async function getHeadToHead(league, type, id1, id2) {
  const sortedIds = [id1, id2].sort((a, b) => a - b);
  const key = `h2h:${league}:${type}:${sortedIds[0]}:${sortedIds[1]}`;

  return cached(key, TTL_30D, async () => {
    if (type === "teams") {
      const { rows } = await pool.query(
        `SELECT g.id, g.date, g.status, g.homescore, g.awayscore, g.winnerid,
                g.hometeamid, g.awayteamid,
                th.name AS home_team_name, th.shortname AS home_shortname, th.logo_url AS home_logo,
                ta.name AS away_team_name, ta.shortname AS away_shortname, ta.logo_url AS away_logo
         FROM games g
         JOIN teams th ON g.hometeamid = th.id
         JOIN teams ta ON g.awayteamid = ta.id
         WHERE g.league = $1
           AND g.hometeamid IN ($2, $3)
           AND g.awayteamid IN ($2, $3)
           AND g.hometeamid != g.awayteamid
           AND g.status ILIKE '%Final%'
         ORDER BY g.date DESC
         LIMIT 20`,
        [league, sortedIds[0], sortedIds[1]]
      );
      return rows;
    }

    // type === "players"
    const { rows } = await pool.query(
      `SELECT g.id, g.date, g.status, g.homescore, g.awayscore, g.winnerid,
              g.hometeamid, g.awayteamid,
              th.name AS home_team_name, th.shortname AS home_shortname, th.logo_url AS home_logo,
              ta.name AS away_team_name, ta.shortname AS away_shortname, ta.logo_url AS away_logo
       FROM stats s1
       JOIN stats s2 ON s1.gameid = s2.gameid
       JOIN games g ON s1.gameid = g.id
       JOIN teams th ON g.hometeamid = th.id
       JOIN teams ta ON g.awayteamid = ta.id
       WHERE s1.playerid = $1
         AND s2.playerid = $2
         AND g.league = $3
         AND g.status ILIKE '%Final%'
       ORDER BY g.date DESC
       LIMIT 20`,
      [sortedIds[0], sortedIds[1], league]
    );
    return rows;
  });
}
