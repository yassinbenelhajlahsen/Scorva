import axios from "axios";
import logger from "../logger.js";
import { getSportPath, withRetry } from "./espn/espnAPIClient.js";

const log = logger.child({ worker: "syncInjuries" });

const ESPN_STATUS_MAP = {
  active: "active",
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

      for (const entry of entries) {
        const espnPlayerId = extractEspnPlayerId(entry?.athlete);
        if (!Number.isFinite(espnPlayerId)) continue;
        const status = normalizeStatus(entry?.status);
        if (!status) continue;

        const description =
          entry?.shortComment ||
          entry?.longComment ||
          entry?.details?.type ||
          null;

        const res = await client.query(
          `UPDATE players
              SET status = $1,
                  status_description = $2,
                  status_updated_at = NOW()
            WHERE espn_playerid = $3 AND league = $4`,
          [status, description, espnPlayerId, leagueSlug],
        );
        if (res.rowCount > 0) {
          updated += res.rowCount;
          injuredEspnIds.push(espnPlayerId);
        }
      }

      // Clear any player on this team whose ESPN id wasn't in the injury feed
      const clearRes = await client.query(
        `UPDATE players
            SET status = NULL,
                status_description = NULL,
                status_updated_at = NOW()
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
    const staleRes = await client.query(
      `UPDATE players
          SET status = NULL,
              status_description = NULL,
              status_updated_at = NOW()
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
