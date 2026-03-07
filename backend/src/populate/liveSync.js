import dotenv from "dotenv";
import { Pool } from "pg";
import { processEvent, clearPlayerCache } from "./src/eventProcessor.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const LEAGUES = [
  { slug: "nba", sport: "basketball" },
  { slug: "nfl", sport: "football" },
  { slug: "nhl", sport: "hockey" },
];

const SCOREBOARD_URL = (sport, league) =>
  `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;

const TICK_MS = 15_000;
const FULL_UPDATE_INTERVAL_MS = 120_000;
const NO_GAMES_SLEEP_MS = 5 * 60 * 1000;

// Per-event tracking for two-tier strategy
// eventId → { lastFullUpdate: timestamp, lastPeriod: number|null }
const eventState = new Map();

async function fetchLiveEvents(sport, leagueSlug) {
  const res = await fetch(SCOREBOARD_URL(sport, leagueSlug));
  const data = await res.json();
  return (data.events ?? []).filter((e) => {
    const state = e.status?.type?.state;
    return state !== "pre" && state !== "post";
  });
}

/**
 * Fast path: UPDATE scores, status, clock, current_period, and quarter strings
 * from scoreboard data only. No summary API call. Uses eventid as key.
 */
export async function upsertGameScoreboard(client, leagueSlug, event) {
  const espnEventId = parseInt(event.id, 10);
  if (Number.isNaN(espnEventId)) return;

  const comps = event.competitions?.[0]?.competitors || [];
  const homeComp = comps.find((c) => c.homeAway === "home");
  const awayComp = comps.find((c) => c.homeAway === "away");
  if (!homeComp || !awayComp) return;

  const homeScore =
    homeComp.score !== undefined ? parseInt(homeComp.score, 10) : null;
  const awayScore =
    awayComp.score !== undefined ? parseInt(awayComp.score, 10) : null;
  const status = event.status?.type?.description ?? null;
  const currentPeriod = event.status?.period ?? null;
  const clock = event.status?.displayClock ?? null;

  // Extract quarter/period strings from linescores
  const periodsMap = {};
  for (const teamComp of comps) {
    if (!teamComp.linescores) continue;
    const sideKey = teamComp.homeAway === "home" ? "home" : "away";
    for (const ls of teamComp.linescores) {
      const p = ls.period.toString();
      if (!periodsMap[p]) periodsMap[p] = { home: null, away: null };
      periodsMap[p][sideKey] = ls.value;
    }
  }

  const quarters = {
    first: null, second: null, third: null, fourth: null,
    ot1: null, ot2: null, ot3: null, ot4: null,
  };
  const periodKeys = ["first", "second", "third", "fourth", "ot1", "ot2", "ot3", "ot4"];
  Object.entries(periodsMap).forEach(([p, scores]) => {
    const h = scores.home !== null ? scores.home : "-";
    const a = scores.away !== null ? scores.away : "-";
    const idx = parseInt(p, 10) - 1;
    if (idx >= 0 && idx < periodKeys.length) {
      quarters[periodKeys[idx]] = `${h}-${a}`;
    }
  });

  await client.query(
    `UPDATE games
     SET homescore      = $1,
         awayscore      = $2,
         status         = $3,
         current_period = $4,
         clock          = $5,
         firstqtr       = COALESCE($6, firstqtr),
         secondqtr      = COALESCE($7, secondqtr),
         thirdqtr       = COALESCE($8, thirdqtr),
         fourthqtr      = COALESCE($9, fourthqtr),
         ot1            = COALESCE($10, ot1),
         ot2            = COALESCE($11, ot2),
         ot3            = COALESCE($12, ot3),
         ot4            = COALESCE($13, ot4)
     WHERE eventid = $14 AND league = $15`,
    [
      homeScore, awayScore, status, currentPeriod, clock,
      quarters.first, quarters.second, quarters.third, quarters.fourth,
      quarters.ot1, quarters.ot2, quarters.ot3, quarters.ot4,
      espnEventId, leagueSlug,
    ]
  );
  await client.query("SELECT pg_notify('game_updated', $1)", [String(espnEventId)]);
}

async function tick(liveLeagues) {
  const stillLive = [];

  for (const { slug, sport } of liveLeagues) {
    let events;
    try {
      events = await fetchLiveEvents(sport, slug);
    } catch (err) {
      console.error(`[liveSync] Failed to fetch ${slug} scoreboard: ${err.message}`);
      stillLive.push({ slug, sport }); // keep retrying this league
      continue;
    }

    if (events.length) stillLive.push({ slug, sport });

    const now = Date.now();
    const client = await pool.connect();
    try {
      for (let i = 0; i < events.length; i += 5) {
        await Promise.all(
          events.slice(i, i + 5).map(async (event) => {
            const eventId = parseInt(event.id, 10);
            const state = eventState.get(eventId) ?? { lastFullUpdate: 0, lastPeriod: null };
            const currentPeriod = event.status?.period ?? null;
            const periodChanged = currentPeriod !== state.lastPeriod;
            const needsFullUpdate =
              now - state.lastFullUpdate > FULL_UPDATE_INTERVAL_MS || periodChanged;

            if (needsFullUpdate) {
              try {
                await processEvent(client, slug, event);
                eventState.set(eventId, { lastFullUpdate: now, lastPeriod: currentPeriod });
                await client.query("SELECT pg_notify('game_updated', $1)", [String(eventId)]);
              } catch (err) {
                console.error(`[liveSync] Full update failed for event ${eventId}: ${err.message}`);
                // Fall back to fast path
                try {
                  await client.query("ROLLBACK");
                } catch (_) { /* ignore */ }
                await upsertGameScoreboard(client, slug, event);
                eventState.set(eventId, { ...state, lastPeriod: currentPeriod });
              }
            } else {
              await upsertGameScoreboard(client, slug, event);
              eventState.set(eventId, { ...state, lastPeriod: currentPeriod });
            }
          })
        );
      }
    } finally {
      client.release();
    }
  }

  return stillLive;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("[liveSync] Worker started.");

  let shuttingDown = false;
  let handle = null;

  const shutdown = async () => {
    shuttingDown = true;
    if (handle) clearTimeout(handle);
    console.log("[liveSync] Shutting down...");
    clearPlayerCache();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // eslint-disable-next-line no-constant-condition
  while (!shuttingDown) {
    // Discover live leagues
    let liveLeagues = [];
    for (const { slug, sport } of LEAGUES) {
      try {
        const events = await fetchLiveEvents(sport, slug);
        if (events.length) liveLeagues.push({ slug, sport });
      } catch (err) {
        console.error(`[liveSync] Failed to check ${slug}: ${err.message}`);
      }
    }

    if (!liveLeagues.length) {
      console.log(`[liveSync] No live games. Sleeping ${NO_GAMES_SLEEP_MS / 60000} min...`);
      await sleep(NO_GAMES_SLEEP_MS);
      continue;
    }

    console.log(`[liveSync] Live games: ${liveLeagues.map((l) => l.slug).join(", ")}. Starting 30s sync.`);

    // Run ticks until no games remain
    liveLeagues = await tick(liveLeagues);

    while (!shuttingDown && liveLeagues.length) {
      await sleep(TICK_MS);
      liveLeagues = await tick(liveLeagues);
    }

    if (!shuttingDown) {
      console.log("[liveSync] All games finished. Returning to idle.");
      clearPlayerCache();
      eventState.clear();
    }
  }
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("[liveSync] Fatal:", err);
    process.exit(1);
  });
}
