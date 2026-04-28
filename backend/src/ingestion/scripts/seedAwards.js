import dotenv from "dotenv";
import { Pool } from "pg";
import { parseArgs } from "util";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import logger from "../../logger.js";
import { mapEspnAward, displayLabel, isKnownOutOfScope } from "../awards/awardTypeMap.js";
import { toEspnYear, decrementSeason, seasonMatchesLeague } from "../awards/seasonTranslator.js";
import { fetchAwardIndex, fetchAward } from "../awards/espnAwardsClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "seedAwards" });

const SUPPORTED_LEAGUES = ["nba", "nfl", "nhl"];

const HELP = `
Seed player awards from ESPN's awards endpoint.

Usage:
  node backend/src/ingestion/scripts/seedAwards.js [flags]

Flags:
  --league <nba|nfl|nhl>   Restrict to one league (default: all three)
  --season <string>        Single season (NBA/NHL: 'YYYY-YY', NFL: 'YYYY')
  --backfill               Walk seasons descending until ESPN returns no data
  --dry-run                Fetch and log; skip DB writes
  --help                   Show this help

Examples:
  node backend/src/ingestion/scripts/seedAwards.js --season 2024-25
  node backend/src/ingestion/scripts/seedAwards.js --league nba --backfill --dry-run
`;

function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      league: { type: "string" },
      season: { type: "string" },
      backfill: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });
  return values;
}

function validateArgs(args) {
  if (args.help) return { ok: false, exitCode: 0, message: HELP };
  if (!args.season && !args.backfill) {
    return { ok: false, exitCode: 0, message: HELP };
  }
  if (args.season && args.backfill) {
    return { ok: false, exitCode: 1, message: "Error: --season and --backfill are mutually exclusive.\n" + HELP };
  }
  if (args.league && !SUPPORTED_LEAGUES.includes(args.league.toLowerCase())) {
    return { ok: false, exitCode: 1, message: `Error: --league must be one of ${SUPPORTED_LEAGUES.join(", ")}\n` };
  }
  return { ok: true };
}

function leaguesToProcess(args) {
  if (args.league) return [args.league.toLowerCase()];
  // When --league is omitted and --season is given, only run the leagues whose
  // season-string format matches (NBA/NHL: YYYY-YY, NFL: YYYY).
  if (args.season) {
    return SUPPORTED_LEAGUES.filter((lg) => seasonMatchesLeague(lg, args.season));
  }
  return SUPPORTED_LEAGUES;
}

function emptySummary() {
  return {
    inserted: 0,
    skipped: 0,
    unmatched: [],
    unmapped: [],
    outOfScope: 0,
    errors: 0,
  };
}

async function processSeason({ league, season, dryRun, pool, summary }) {
  const espnYear = toEspnYear(league, season);
  let refs;
  try {
    refs = await fetchAwardIndex(league, espnYear);
  } catch (err) {
    log.error({ err: err.message, league, season }, "fetchAwardIndex failed");
    summary.errors += 1;
    return { hadData: false };
  }
  if (refs === null) {
    log.info({ league, season }, "ESPN returned 404 for season awards index");
    return { hadData: false };
  }
  if (refs.length === 0) {
    log.info({ league, season }, "ESPN returned empty awards index");
    return { hadData: false };
  }

  log.info({ league, season, awards: refs.length }, "processing awards");

  for (const ref of refs) {
    let award;
    try {
      award = await fetchAward(ref);
    } catch (err) {
      log.error({ err: err.message, ref }, "fetchAward failed");
      summary.errors += 1;
      continue;
    }
    const mapped = mapEspnAward(league, award.name);
    if (!mapped) {
      if (isKnownOutOfScope(league, award.name)) {
        summary.outOfScope += 1;
      } else {
        summary.unmapped.push({ league, season, espnId: award.id, espnName: award.name });
        log.warn({ league, season, espnId: award.id, espnName: award.name }, "unmapped award");
      }
      continue;
    }
    for (const winner of award.winners) {
      const playerRow = await pool.query(
        `SELECT id FROM players WHERE espn_playerid = $1 AND league = $2 LIMIT 1`,
        [winner.athleteId, league],
      );
      const playerId = playerRow.rows[0]?.id;
      if (!playerId) {
        summary.unmatched.push({ league, season, awardType: mapped.awardType, espnAthleteId: winner.athleteId });
        log.warn({ league, season, awardType: mapped.awardType, espnAthleteId: winner.athleteId }, "unmatched athlete");
        continue;
      }
      if (dryRun) {
        summary.inserted += 1;
        continue;
      }
      const result = await pool.query(
        `INSERT INTO player_awards (player_id, league, season, award_type, award_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (player_id, league, season, award_type) DO NOTHING
         RETURNING id`,
        [playerId, league, season, mapped.awardType, award.name],
      );
      if (result.rowCount === 1) summary.inserted += 1;
      else summary.skipped += 1;
    }
  }

  return { hadData: true };
}

async function processLeague({ league, args, pool, summary }) {
  if (args.season) {
    await processSeason({ league, season: args.season, dryRun: args["dry-run"], pool, summary });
    return;
  }
  // Backfill: walk descending starting from current ESPN year for that league.
  const now = new Date();
  let season;
  if (league === "nfl") {
    // NFL season string is the start year. ESPN labels by start year too.
    season = String(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);
  } else {
    // NBA / NHL season strings are 'YYYY-YY' starting in fall.
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const endTwo = String((startYear + 1) % 100).padStart(2, "0");
    season = `${startYear}-${endTwo}`;
  }
  while (true) {
    const { hadData } = await processSeason({
      league,
      season,
      dryRun: args["dry-run"],
      pool,
      summary,
    });
    if (!hadData) break;
    season = decrementSeason(league, season);
  }
}

function printSummary(summary, dryRun, durationMs) {
  const prefix = dryRun ? "[DRY RUN — no DB writes] " : "";
  const lines = [
    `${prefix}Awards seed complete.`,
    `  inserted:    ${summary.inserted}`,
    `  skipped:     ${summary.skipped}    (already in DB)`,
    `  unmatched:   ${summary.unmatched.length}    (athlete not in players table)`,
    `  unmapped:    ${summary.unmapped.length}    (award name not in taxonomy)`,
    `  outOfScope:  ${summary.outOfScope}    (known but intentionally not tracked)`,
    `  errors:      ${summary.errors}`,
    `  duration:    ${(durationMs / 1000).toFixed(1)}s`,
  ];
  if (summary.unmatched.length > 0) {
    lines.push("", "Unmatched athletes:");
    for (const u of summary.unmatched.slice(0, 50)) {
      lines.push(`  [${u.league}/${u.season}] award=${u.awardType} espnAthleteId=${u.espnAthleteId} (label=${displayLabel(u.awardType)})`);
    }
    if (summary.unmatched.length > 50) {
      lines.push(`  ... and ${summary.unmatched.length - 50} more`);
    }
  }
  if (summary.unmapped.length > 0) {
    lines.push("", "Unmapped awards:");
    for (const u of summary.unmapped.slice(0, 50)) {
      lines.push(`  [${u.league}/${u.season}] espnId=${u.espnId} name="${u.espnName}"`);
    }
    if (summary.unmapped.length > 50) {
      lines.push(`  ... and ${summary.unmapped.length - 50} more`);
    }
  }
  process.stdout.write(lines.join("\n") + "\n");
}

export async function runSeed({ pool, args }) {
  const summary = emptySummary();
  const start = Date.now();
  for (const league of leaguesToProcess(args)) {
    try {
      await processLeague({ league, args, pool, summary });
    } catch (err) {
      log.error({ err: err.message, league }, "league processing failed");
      summary.errors += 1;
    }
  }
  printSummary(summary, args["dry-run"], Date.now() - start);
  return summary;
}

async function main() {
  let args;
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n${HELP}`);
    process.exit(1);
  }
  const validation = validateArgs(args);
  if (!validation.ok) {
    process.stdout.write(validation.message);
    process.exit(validation.exitCode);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  try {
    await runSeed({ pool, args });
  } finally {
    await pool.end();
  }
}

if (resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    log.error({ err: err.message, stack: err.stack }, "seedAwards fatal error");
    process.exit(1);
  });
}
