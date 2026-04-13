import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { buildH2HMatrix, sortWithTiebreakers } from "../../utils/tiebreaker.js";

export async function getRegularSeasonGames(league, season) {
  const currentSeason = await getCurrentSeason(league);
  const resolvedSeason = season || currentSeason;
  const isCurrent = resolvedSeason === currentSeason;
  const ttl = isCurrent ? 300 : 30 * 86400;

  return cached(`h2h-games:${league}:${resolvedSeason}`, ttl, async () => {
    const { rows } = await pool.query(
      `SELECT hometeamid, awayteamid, winnerid, homescore, awayscore
         FROM games
        WHERE league = $1
          AND season = COALESCE($2, (
            SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL
          ))
          AND status ILIKE 'Final%'
          AND type IN ('regular', 'makeup')`,
      [league, season || null]
    );
    return rows;
  });
}

export async function getStandings(league, season) {
  const currentSeason = await getCurrentSeason(league);
  const resolvedSeason = season || currentSeason;
  const isCurrent = resolvedSeason === currentSeason;
  const ttl = isCurrent ? 300 : 30 * 86400;

  return cached(`standings:${league}:${resolvedSeason}`, ttl, async () => {
    const [standingsResult, h2hGames] = await Promise.all([
      pool.query(
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
            AND g.type IN ('regular', 'makeup')
          WHERE t.league = $1
          GROUP BY t.id, t.name, t.shortname, t.location, t.conf, t.logo_url,
                   t.primary_color`,
        [league, season || null]
      ),
      getRegularSeasonGames(league, season),
    ]);

    const teams = standingsResult.rows.map((r) => ({
      ...r,
      wins: Number(r.wins) || 0,
      losses: Number(r.losses) || 0,
      otl: Number(r.otl) || 0,
    }));

    const confByTeamId = new Map();
    for (const t of teams) {
      confByTeamId.set(t.id, (t.conf || "").toLowerCase());
    }

    const { matrix, teamPointDiffs, confRecords } = buildH2HMatrix(h2hGames, confByTeamId);

    for (const t of teams) {
      t.pointDiff = teamPointDiffs.get(t.id) ?? 0;
      const gp = t.wins + t.losses;
      if (league === "nhl") {
        t.ptsPct = gp > 0 ? (2 * t.wins + t.otl) / (2 * gp) : 0;
      } else {
        t.winPct = gp > 0 ? t.wins / gp : 0;
      }
      const cr = confRecords.get(t.id);
      const confGp = cr ? cr.wins + cr.losses : 0;
      t.confWinPct = confGp > 0 ? cr.wins / confGp : 0;
    }

    const conferences = new Map();
    for (const t of teams) {
      const conf = (t.conf || "").toLowerCase();
      if (!conferences.has(conf)) conferences.set(conf, []);
      conferences.get(conf).push(t);
    }

    const sorted = [];
    const confOrder = [...conferences.keys()].sort();
    for (const conf of confOrder) {
      sorted.push(...sortWithTiebreakers(conferences.get(conf), matrix, league));
    }

    return sorted;
  });
}
