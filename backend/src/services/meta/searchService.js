import pool from "../../db/db.js";
import { tryParseDate } from "../../utils/dateParser.js";
import { parseSearchTerm } from "./searchParser.js";
import { resolveTeams } from "./teamResolver.js";

const RESULT_LIMIT = 15;
const PLAYER_SUBSTRING_MIN_LEN = 3;
const FUZZY_PLAYER_THRESHOLD = 0.3;

const TYPE_RANK = { team: 1, player: 2, game: 3 };

const TEAM_ENTITY_QUERY = `
  SELECT id, name, league, logo_url AS "imageUrl", shortname,
         NULL::date AS date, 'team' AS type,
         NULL AS position, NULL AS team_name
  FROM teams
  WHERE id = ANY($1::int[]) AND conf IS NOT NULL
`;

const PLAYER_ILIKE_QUERY = `
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl",
           NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name, p.popularity
    FROM players p
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE p.name ILIKE $1
  )
  UNION ALL
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl",
           NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name, p.popularity
    FROM player_aliases pa
    JOIN players p ON pa.player_id = p.id
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE pa.alias ILIKE $1
  )
  ORDER BY popularity DESC NULLS LAST
  LIMIT 15
`;

const PLAYER_FUZZY_QUERY = `
  SELECT p.id, p.name, p.league, p.image_url AS "imageUrl",
         NULL AS shortname, NULL::date AS date, 'player' AS type,
         p.position, t.name AS team_name, p.popularity,
         similarity(p.name, $1) AS sim
  FROM players p
  LEFT JOIN teams t ON p.teamid = t.id
  WHERE similarity(p.name, $1) > $2
  ORDER BY sim DESC, popularity DESC NULLS LAST
  LIMIT 15
`;

const TOP_SEASONS_CTE = `
  WITH top_seasons AS (
    SELECT league, season FROM (
      SELECT league, season,
             ROW_NUMBER() OVER (PARTITION BY league ORDER BY season DESC) AS rn
      FROM (SELECT DISTINCT league, season FROM games) s
    ) t WHERE rn <= 3
  )
`;

const MATCHUP_GAMES_QUERY = `
  ${TOP_SEASONS_CTE}
  SELECT g.id,
         CONCAT(ht.shortname, ' vs ', at.shortname) AS name,
         g.league,
         NULL AS "imageUrl",
         NULL AS shortname,
         g.date,
         'game' AS type,
         NULL AS position,
         NULL AS team_name
  FROM games g
  JOIN teams ht ON g.hometeamid = ht.id
  JOIN teams at ON g.awayteamid = at.id
  WHERE g.season IN (SELECT season FROM top_seasons WHERE league = g.league)
    AND ht.conf IS NOT NULL AND at.conf IS NOT NULL
    AND (
      (g.hometeamid = ANY($1::int[]) AND g.awayteamid = ANY($2::int[]))
      OR
      (g.hometeamid = ANY($2::int[]) AND g.awayteamid = ANY($1::int[]))
    )
    AND ($3::date IS NULL OR g.date = $3::date)
  ORDER BY g.date DESC
  LIMIT 15
`;

const PER_TEAM_GAMES_QUERY = `
  ${TOP_SEASONS_CTE}
  SELECT g.id,
         CONCAT(ht.shortname, ' vs ', at.shortname) AS name,
         g.league,
         NULL AS "imageUrl",
         NULL AS shortname,
         g.date,
         'game' AS type,
         NULL AS position,
         NULL AS team_name
  FROM unnest($1::int[]) AS team_id
  JOIN LATERAL (
    (
      SELECT id, hometeamid, awayteamid, date, league
      FROM games
      WHERE (hometeamid = team_id OR awayteamid = team_id)
        AND season IN (SELECT season FROM top_seasons WHERE league = games.league)
        AND date >= CURRENT_DATE
      ORDER BY date ASC
      LIMIT 2
    )
    UNION ALL
    (
      SELECT id, hometeamid, awayteamid, date, league
      FROM games
      WHERE (hometeamid = team_id OR awayteamid = team_id)
        AND season IN (SELECT season FROM top_seasons WHERE league = games.league)
        AND date < CURRENT_DATE
      ORDER BY date DESC
      LIMIT 3
    )
  ) g ON TRUE
  JOIN teams ht ON g.hometeamid = ht.id
  JOIN teams at ON g.awayteamid = at.id
  WHERE ht.conf IS NOT NULL AND at.conf IS NOT NULL
`;

function escapeIlike(s) {
  return s.replace(/[%_\\]/g, "\\$&");
}

function dedupeByTypeId(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function compareRows(a, b) {
  const sa = a.score ?? 99;
  const sb = b.score ?? 99;
  if (sa !== sb) return sa - sb;
  const ta = TYPE_RANK[a.type] ?? 99;
  const tb = TYPE_RANK[b.type] ?? 99;
  if (ta !== tb) return ta - tb;
  const pa = a.popularity ?? 0;
  const pb = b.popularity ?? 0;
  if (pa !== pb) return pb - pa;
  if (a.type === "game" && b.type === "game") {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return Math.abs(da - Date.now()) - Math.abs(db - Date.now());
  }
  return String(a.name || "").localeCompare(String(b.name || ""));
}

function stripInternalFields(rows) {
  return rows.map(({ score: _score, popularity: _popularity, sim: _sim, ...rest }) => rest);
}

async function queryTeamEntities(ids) {
  if (!ids.length) return [];
  const res = await pool.query(TEAM_ENTITY_QUERY, [ids]);
  return res.rows;
}

async function queryPlayers(token) {
  const trimmed = token.trim();
  if (trimmed.length < PLAYER_SUBSTRING_MIN_LEN) return [];

  const escaped = escapeIlike(trimmed);
  const ilike = await pool.query(PLAYER_ILIKE_QUERY, [`%${escaped}%`]);
  if (ilike.rows.length > 0) return ilike.rows;

  const fuzzy = await pool.query(PLAYER_FUZZY_QUERY, [
    trimmed,
    FUZZY_PLAYER_THRESHOLD,
  ]);
  return fuzzy.rows;
}

async function queryMatchupGames(lhsIds, rhsIds, dateFilter) {
  const res = await pool.query(MATCHUP_GAMES_QUERY, [lhsIds, rhsIds, dateFilter]);
  return res.rows;
}

async function queryPerTeamGames(teamIds) {
  if (!teamIds.length) return [];
  const res = await pool.query(PER_TEAM_GAMES_QUERY, [teamIds]);
  return res.rows;
}

async function searchMatchup(parsed, rawTerm) {
  const [lhs, rhs] = await Promise.all([
    resolveTeams(parsed.lhs),
    resolveTeams(parsed.rhs),
  ]);

  if (lhs.length === 0 && rhs.length === 0) {
    return { result: null, fallbackToken: null };
  }
  if (lhs.length === 0) {
    return { result: null, fallbackToken: parsed.rhs };
  }
  if (rhs.length === 0) {
    return { result: null, fallbackToken: parsed.lhs };
  }

  const lhsIds = lhs.map((t) => t.id);
  const rhsIds = rhs.map((t) => t.id);
  const date = tryParseDate(rawTerm);

  const [teamRows, gameRows] = await Promise.all([
    queryTeamEntities([...lhsIds, ...rhsIds]),
    queryMatchupGames(lhsIds, rhsIds, date),
  ]);

  const teamScored = teamRows.map((row) => {
    const match = [...lhs, ...rhs].find((r) => r.id === row.id);
    return { ...row, score: match?.score ?? 99 };
  });
  const gameScored = gameRows.map((row) => ({ ...row, score: 10 }));

  const merged = dedupeByTypeId([...teamScored, ...gameScored]);
  merged.sort(compareRows);
  return { result: stripInternalFields(merged.slice(0, RESULT_LIMIT)), fallbackToken: null };
}

async function searchSingle(parsed) {
  const resolved = await resolveTeams(parsed.token);
  const teamIds = resolved.map((r) => r.id);

  const [teamRows, playerRows, gameRows] = await Promise.all([
    queryTeamEntities(teamIds),
    queryPlayers(parsed.token),
    queryPerTeamGames(teamIds),
  ]);

  const teamScored = teamRows.map((row) => {
    const match = resolved.find((r) => r.id === row.id);
    return { ...row, score: match?.score ?? 99 };
  });
  const gameScored = gameRows.map((row) => ({ ...row, score: 50 }));
  const playerScored = playerRows.map((row) => ({ ...row, score: 30 }));

  const merged = dedupeByTypeId([...teamScored, ...playerScored, ...gameScored]);
  merged.sort(compareRows);
  return stripInternalFields(merged.slice(0, RESULT_LIMIT));
}

export async function search(term) {
  const parsed = parseSearchTerm(term);
  if (parsed.kind === "empty") return [];

  if (parsed.kind === "matchup") {
    const matchup = await searchMatchup(parsed, term);
    if (matchup.result !== null) return matchup.result;
    if (matchup.fallbackToken !== null) {
      return searchSingle({ kind: "single", token: matchup.fallbackToken });
    }
    return [];
  }

  return searchSingle(parsed);
}
