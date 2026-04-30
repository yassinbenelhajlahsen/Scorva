import axios from "axios";
import pool from "../../db/db.js";
import logger from "../../logger.js";
import { getSportPath } from "../../utils/sportPath.js";
import { withRetry } from "../../ingestion/espn/espnAPIClient.js";
import { parseMove } from "./movesParser.js";

const log = logger.child({ module: "movesReports" });

function buildUrl(league) {
  const sport = getSportPath(league);
  return `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/transactions?limit=200`;
}

function slugForName(name) {
  return name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

async function fetchEspn(league) {
  try {
    const data = await withRetry(
      () => axios.get(buildUrl(league)).then((r) => r.data),
      { retries: 2, label: `transactions:${league}` }
    );
    return Array.isArray(data?.transactions) ? data.transactions : [];
  } catch (err) {
    log.warn({ err: err?.message, league }, "transactions fetch failed");
    return [];
  }
}

async function loadPlayersByName(league) {
  const res = await pool.query(
    `SELECT id, name, image_url FROM players WHERE league = $1`,
    [league]
  );
  const map = new Map();
  for (const row of res.rows) {
    map.set(row.name.toLowerCase(), {
      id: row.id,
      name: row.name,
      slug: slugForName(row.name),
      imageUrl: row.image_url,
    });
  }
  return map;
}

async function loadTeamsByEspnId(league, espnIds) {
  if (espnIds.length === 0) return new Map();
  const res = await pool.query(
    `SELECT id, espnid, abbreviation, name, logo_url FROM teams
      WHERE league = $1 AND espnid = ANY($2::int[])`,
    [league, espnIds]
  );
  const map = new Map();
  for (const row of res.rows) {
    map.set(String(row.espnid), {
      id: row.id,
      abbreviation: row.abbreviation,
      name: row.name,
      logoUrl: row.logo_url,
    });
  }
  return map;
}

function isoDate(s) {
  // ESPN omits the seconds — be lenient.
  return new Date(s).toISOString();
}

export async function getMovesForLeague(league) {
  const transactions = await fetchEspn(league);
  if (transactions.length === 0) return [];

  const espnTeamIds = [...new Set(
    transactions.map((t) => t.team?.id).filter(Boolean).map((id) => parseInt(id, 10))
  )];
  const [teamsByEspn, playersByName] = await Promise.all([
    loadTeamsByEspnId(league, espnTeamIds),
    loadPlayersByName(league),
  ]);

  const out = [];
  transactions.forEach((t, idx) => {
    const teamLocal = teamsByEspn.get(String(t.team?.id));
    if (!teamLocal) return;

    const parsed = parseMove({
      description: t.description,
      team: teamLocal,
      players: playersByName,
    });
    if (!parsed) return;

    const dateIso = isoDate(t.date);
    parsed.forEach((m, j) => {
      out.push({
        id: `move-${dateIso.slice(0, 10)}-${teamLocal.abbreviation.toLowerCase()}-${idx}-${j}`,
        type: "move",
        date: dateIso,
        league,
        player: { ...m.player, league },
        action: m.action,
        fromTeam: m.fromTeam,
        toTeam: m.toTeam,
      });
    });
  });

  return out;
}
