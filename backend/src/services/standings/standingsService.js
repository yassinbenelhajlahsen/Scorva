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
      `SELECT hometeamid, awayteamid, winnerid, homescore, awayscore, ot1, fourthqtr
         FROM games
        WHERE league = $1
          AND season = COALESCE($2, (
            SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL
          ))
          AND status ILIKE 'Final%'
          AND type IN ('regular', 'makeup')
          AND (game_label IS NULL OR game_label NOT ILIKE '%play-in%')`,
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
        `SELECT t.id, t.name, t.shortname, t.location, t.conf, t.division, t.logo_url,
              t.primary_color,
            COUNT(*) FILTER (WHERE g.winnerid = t.id) AS wins,
            COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id) AS losses,
            COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id
              AND (g.status IN ('Final/OT', 'Final/SO')
                   OR ($1 = 'nhl' AND (g.fourthqtr IS NOT NULL OR g.ot1 IS NOT NULL)))) AS otl,
            COUNT(*) FILTER (WHERE $1 = 'nfl' AND g.winnerid IS NULL
              AND g.homescore IS NOT NULL
              AND g.homescore = g.awayscore) AS ties
          FROM teams t
          LEFT JOIN games g ON (g.hometeamid = t.id OR g.awayteamid = t.id)
            AND g.league = $1
            AND g.season = COALESCE($2, (
              SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL
            ))
            AND g.status ILIKE 'Final%'
            AND g.type IN ('regular', 'makeup')
            AND (g.game_label IS NULL OR g.game_label NOT ILIKE '%play-in%')
          WHERE t.league = $1
          GROUP BY t.id, t.name, t.shortname, t.location, t.conf, t.division, t.logo_url,
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
      ties: Number(r.ties) || 0,
    }));

    const confByTeamId = new Map();
    const divByTeamId = new Map();
    for (const t of teams) {
      confByTeamId.set(t.id, (t.conf || "").toLowerCase());
      divByTeamId.set(t.id, (t.division || "").toLowerCase());
    }

    const { matrix, teamPointDiffs, teamRegWins, teamGf, confRecords, divRecords } =
      buildH2HMatrix(h2hGames, confByTeamId, league, divByTeamId);

    for (const t of teams) {
      t.pointDiff = teamPointDiffs.get(t.id) ?? 0;
      if (league === "nhl") {
        const gp = t.wins + t.losses;
        t.ptsPct = gp > 0 ? (2 * t.wins + t.otl) / (2 * gp) : 0;
        t.regWins = teamRegWins.get(t.id) ?? 0;
        t.gf = teamGf.get(t.id) ?? 0;
        const cr = confRecords.get(t.id);
        const confGp = cr ? cr.wins + cr.losses : 0;
        t.confWinPct = confGp > 0 ? cr.wins / confGp : 0;
      } else if (league === "nfl") {
        const gp = t.wins + t.losses + t.ties;
        t.winPct = gp > 0 ? (t.wins + 0.5 * t.ties) / gp : 0;
        const dr = divRecords.get(t.id);
        const divGp = dr ? dr.wins + dr.losses + (dr.ties || 0) : 0;
        t.divWinPct = divGp > 0 ? (dr.wins + 0.5 * (dr.ties || 0)) / divGp : 0;
        const cr = confRecords.get(t.id);
        const confGp = cr ? cr.wins + cr.losses + (cr.ties || 0) : 0;
        t.confWinPct = confGp > 0 ? (cr.wins + 0.5 * (cr.ties || 0)) / confGp : 0;
      } else {
        const gp = t.wins + t.losses;
        t.winPct = gp > 0 ? t.wins / gp : 0;
        const cr = confRecords.get(t.id);
        const confGp = cr ? cr.wins + cr.losses : 0;
        t.confWinPct = confGp > 0 ? cr.wins / confGp : 0;
      }
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
