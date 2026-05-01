import axios from "axios";
import logger from "../logger.js";
import { getSportPath, withRetry } from "./espn/espnAPIClient.js";

const log = logger.child({ worker: "syncInjuries" });

// "active" is intentionally absent — ESPN's NFL injury feed tags contract
// signings, trade announcements, and return-from-injury notes with
// status="Active" plus roster-news shortComment text. Mapping it as a status
// would pollute players.status + player_status_history with non-injury events
// (and on subsequent syncs they'd cycle active->null via the clear sweep).
// A genuinely-recovered player is still handled correctly: they fall through
// the change-detection (no entry is processed for them this cycle), so the
// per-team clear sweep transitions them from their prior status to null.
const ESPN_STATUS_MAP = {
  "day-to-day": "day-to-day",
  "day to day": "day-to-day",
  questionable: "questionable",
  doubtful: "doubtful",
  out: "out",
  "out for season": "out",
  "injured reserve": "ir",
  ir: "ir",
  "injured-reserve": "ir",
  "o-ir": "ir",
  suspended: "suspended",
  suspension: "suspended",
};

export function normalizeStatus(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return ESPN_STATUS_MAP[key] || null;
}

function cleanDesc(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  return t === "" ? null : t;
}

function parseEntryDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function toMs(v) {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

// The per-team endpoint (`/teams/{id}/injuries`) returns `{}` — use the
// league-wide feed instead. Shape: { injuries: [{id, displayName, injuries: [...]}] }
async function fetchLeagueInjuries(leagueSlug) {
  const path = getSportPath(leagueSlug);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/${leagueSlug}/injuries`;
  try {
    const resp = await withRetry(() => axios.get(url), {
      label: `injuries:${leagueSlug}`,
    });
    return resp.data?.injuries || [];
  } catch (err) {
    log.warn(
      { err: err?.message, status: err?.response?.status, league: leagueSlug },
      "failed to fetch league injuries",
    );
    return null;
  }
}

// The league-wide feed omits `athlete.id`; the numeric id only appears inside
// `athlete.links[].href` (e.g. `/nba/player/_/id/3146557/jock-landale`).
function extractEspnPlayerId(athlete) {
  if (!athlete) return null;
  const direct = parseInt(athlete.id, 10);
  if (Number.isFinite(direct)) return direct;
  const links = Array.isArray(athlete.links) ? athlete.links : [];
  for (const link of links) {
    const match = /\/id\/(\d+)/.exec(link?.href || "");
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

const STALE_CLEAR_DAYS = 14;

export async function syncInjuriesForLeague(pool, leagueSlug) {
  const client = await pool.connect();
  let updated = 0;
  let cleared = 0;
  let staleCleared = 0;
  let teamsProcessed = 0;

  try {
    const blocks = await fetchLeagueInjuries(leagueSlug);
    if (blocks === null) {
      return { teamsProcessed, updated, cleared, staleCleared };
    }

    const byTeam = new Map();
    for (const block of blocks) {
      const teamEspnId = block?.id != null ? String(block.id) : null;
      if (!teamEspnId) continue;
      byTeam.set(teamEspnId, Array.isArray(block?.injuries) ? block.injuries : []);
    }

    const { rows: teams } = await client.query(
      `SELECT id, espnid FROM teams WHERE league = $1 AND espnid IS NOT NULL`,
      [leagueSlug],
    );

    for (const team of teams) {
      teamsProcessed++;
      const entries = byTeam.get(String(team.espnid)) || [];
      const injuredEspnIds = [];

      // Batch-load prior (status, status_description) for every espn_playerid in this
      // team's entries — avoids ~N round-trips per team in favor of a single query.
      const candidateEspnIds = entries
        .map((e) => extractEspnPlayerId(e?.athlete))
        .filter(Number.isFinite);

      const priorMap = new Map();
      if (candidateEspnIds.length > 0) {
        const priors = await client.query(
          `SELECT id, espn_playerid, status, status_description, status_changed_at FROM players
            WHERE espn_playerid = ANY($1::int[]) AND league = $2`,
          [candidateEspnIds, leagueSlug],
        );
        for (const row of priors.rows) priorMap.set(row.espn_playerid, row);
      }

      for (const entry of entries) {
        const espnPlayerId = extractEspnPlayerId(entry?.athlete);
        if (!Number.isFinite(espnPlayerId)) continue;
        const status = normalizeStatus(entry?.status);
        if (!status) continue;

        const description = cleanDesc(
          entry?.shortComment || entry?.longComment || entry?.details?.type,
        );
        const entryDate = parseEntryDate(entry?.date);

        const prev = priorMap.get(espnPlayerId);
        if (!prev) continue;

        // ESPN's `entry.date` is the canonical "this injury report was filed/edited
        // at" timestamp — stable across sync cycles when nothing material changes,
        // and bumped by ESPN when status or report content actually moves. Use it
        // as the change-detection key so news-copy churn (shortComment edits) and
        // missing/whitespace fields don't manufacture history rows every cycle.
        const prevDateMs = toMs(prev.status_changed_at);
        const entryDateMs = entryDate ? entryDate.getTime() : null;
        const dateChanged = entryDateMs !== null && entryDateMs !== prevDateMs;
        const changed = prev.status !== status || dateChanged;

        if (changed) {
          await client.query(
            `INSERT INTO player_status_history
              (player_id, league, prev_status, prev_status_description, new_status, new_status_description, changed_at)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))`,
            [prev.id, leagueSlug, prev.status, prev.status_description, status, description, entryDate],
          );
        }

        const res = await client.query(
          `UPDATE players
              SET status = $1,
                  status_description = COALESCE($2, status_description),
                  status_updated_at = NOW(),
                  status_changed_at = COALESCE($5::timestamptz, status_changed_at)
            WHERE espn_playerid = $3 AND league = $4`,
          [status, description, espnPlayerId, leagueSlug, entryDate],
        );
        if (res.rowCount > 0) {
          updated += res.rowCount;
          injuredEspnIds.push(espnPlayerId);
        }
      }

      // Per-team clear sweep — rewritten to capture pre-state for history
      const toClear = await client.query(
        `SELECT id, league, status, status_description FROM players
          WHERE teamid = $1
            AND league = $2
            AND status IS NOT NULL
            AND NOT (espn_playerid = ANY($3::int[]))`,
        [team.id, leagueSlug, injuredEspnIds],
      );

      for (const row of toClear.rows) {
        await client.query(
          `INSERT INTO player_status_history
            (player_id, league, prev_status, prev_status_description, new_status, new_status_description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [row.id, row.league, row.status, row.status_description, null, null],
        );
      }

      const clearRes = await client.query(
        `UPDATE players
            SET status = NULL,
                status_description = NULL,
                status_updated_at = NOW(),
                status_changed_at = NULL
          WHERE teamid = $1
            AND league = $2
            AND status IS NOT NULL
            AND NOT (espn_playerid = ANY($3::int[]))`,
        [team.id, leagueSlug, injuredEspnIds],
      );
      cleared += clearRes.rowCount;
    }

    // Stale sweep — catches players (traded, cut, retired, team-less) whose
    // injury rows never got refreshed above because they aren't on any active
    // team's injury feed. Anything older than the threshold is cleared.
    const staleRows = await client.query(
      `SELECT id, league, status, status_description FROM players
         WHERE league = $1
           AND status IS NOT NULL
           AND status_updated_at < NOW() - ($2 || ' days')::INTERVAL`,
      [leagueSlug, String(STALE_CLEAR_DAYS)],
    );

    for (const row of staleRows.rows) {
      await client.query(
        `INSERT INTO player_status_history
          (player_id, league, prev_status, prev_status_description, new_status, new_status_description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, row.league, row.status, row.status_description, null, null],
      );
    }

    const staleRes = await client.query(
      `UPDATE players
          SET status = NULL,
              status_description = NULL,
              status_updated_at = NOW(),
              status_changed_at = NULL
        WHERE league = $1
          AND status IS NOT NULL
          AND status_updated_at < NOW() - ($2 || ' days')::INTERVAL`,
      [leagueSlug, String(STALE_CLEAR_DAYS)],
    );
    staleCleared = staleRes.rowCount;

    log.info(
      { league: leagueSlug, teamsProcessed, updated, cleared, staleCleared },
      "injury sync complete",
    );
    return { teamsProcessed, updated, cleared, staleCleared };
  } finally {
    client.release();
  }
}
