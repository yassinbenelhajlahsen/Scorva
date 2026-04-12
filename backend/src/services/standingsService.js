import pool from "../db/db.js";
import { cached } from "../cache/cache.js";
import { getCurrentSeason } from "../cache/seasons.js";

export async function getStandings(league, season) {
  const currentSeason = await getCurrentSeason(league);
  const resolvedSeason = season || currentSeason;
  const isCurrent = resolvedSeason === currentSeason;
  const ttl = isCurrent ? 300 : 30 * 86400; // 5 min current, 30 days past

  return cached(`standings:${league}:${resolvedSeason}`, ttl, async () => {
    const result = await pool.query(
      `SELECT t.id, t.name, t.shortname, t.location, t.conf, t.logo_url,
            t.primary_color,
          COUNT(*) FILTER (WHERE g.winnerid = t.id) AS wins,
          COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id) AS losses,
          COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id
            AND g.status IN ('Final/OT', 'Final/SO')) AS otl
        FROM teams t
        LEFT JOIN games g ON (g.hometeamid = t.id OR g.awayteamid = t.id)
          AND g.league = $1
          AND g.season = COALESCE($2, (
            SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL
          ))
          AND g.status ILIKE 'Final%'
          AND g.type = 'regular'
        WHERE t.league = $1
        GROUP BY t.id, t.name, t.shortname, t.location, t.conf, t.logo_url,
                 t.primary_color
        ORDER BY t.conf, wins DESC, losses ASC`,
      [league, season || null]
    );
    return result.rows;
  });
}
