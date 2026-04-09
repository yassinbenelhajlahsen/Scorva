import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../logger.js";

const log = logger.child({ worker: "historicalUpsert" });
import {
  runDateRangeProcessing,
  clearPlayerCache,
  getPlayerCacheStats,
} from "./eventProcessor.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

function getAllDatesInRange(startISO, endISO) {
  const dates = [];
  const curr = new Date(startISO);
  const last = new Date(endISO);

  while (curr <= last) {
    const yyyy = curr.getUTCFullYear().toString();
    const mm = String(curr.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(curr.getUTCDate()).padStart(2, "0");
    dates.push(`${yyyy}${mm}${dd}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

// Each entry is one season (preseason start → finals/playoffs end).
// Per-season ranges avoid querying thousands of empty off-season days.
// Current 2024-25 / 2025-26 data is intentionally excluded — it's already seeded and healthy.
const leagueSeasons = {
  nba: [
    { seasonStart: "2015-09-30", seasonEnd: "2016-06-19" }, // 2015-16 → Finals Game 7 (CLE def. GSW)
    { seasonStart: "2016-09-28", seasonEnd: "2017-06-12" }, // 2016-17 → Finals Game 5 (GSW def. CLE)
    { seasonStart: "2017-09-28", seasonEnd: "2018-06-08" }, // 2017-18 → Finals Game 4 (GSW def. CLE)
    { seasonStart: "2018-09-25", seasonEnd: "2019-06-13" }, // 2018-19 → Finals Game 6 (TOR def. GSW)
    { seasonStart: "2019-09-30", seasonEnd: "2020-10-11" }, // 2019-20 → bubble Finals Game 6 (LAL def. MIA)
    { seasonStart: "2020-12-01", seasonEnd: "2021-07-20" }, // 2020-21 → Finals Game 6 (MIL def. PHX)
    { seasonStart: "2021-09-28", seasonEnd: "2022-06-16" }, // 2021-22 → Finals Game 6 (GSW def. BOS)
    { seasonStart: "2022-09-28", seasonEnd: "2023-06-12" }, // 2022-23 → Finals Game 5 (DEN def. MIA)
    { seasonStart: "2023-10-03", seasonEnd: "2024-06-17" }, // 2023-24 → Finals Game 5 (BOS def. DAL) — rerun to fix missing stats
  ],
  nhl: [
    { seasonStart: "2015-09-15", seasonEnd: "2016-06-12" }, // 2015-16 → Cup Final Game 6 (PIT def. SJS)
    { seasonStart: "2016-09-22", seasonEnd: "2017-06-11" }, // 2016-17 → Cup Final Game 6 (PIT def. NSH)
    { seasonStart: "2017-09-15", seasonEnd: "2018-06-07" }, // 2017-18 → Cup Final Game 5 (WSH def. VGK)
    { seasonStart: "2018-09-14", seasonEnd: "2019-06-12" }, // 2018-19 → Cup Final Game 7 (STL def. BOS)
    { seasonStart: "2019-09-12", seasonEnd: "2020-09-28" }, // 2019-20 → bubble Cup Final Game 6 (TBL def. DAL)
    { seasonStart: "2021-01-01", seasonEnd: "2021-07-07" }, // 2020-21 → Cup Final Game 5 (TBL def. MTL)
    { seasonStart: "2021-09-23", seasonEnd: "2022-06-26" }, // 2021-22 → Cup Final Game 6 (COL def. TBL)
    { seasonStart: "2022-09-22", seasonEnd: "2023-06-13" }, // 2022-23 → Cup Final Game 6 (VGK def. FLA)
    { seasonStart: "2023-09-23", seasonEnd: "2024-06-24" }, // 2023-24 → Cup Final Game 7 (FLA def. EDM) — rerun to fix missing stats
  ],
  nfl: [
    { seasonStart: "2015-08-09", seasonEnd: "2016-02-07" }, // 2015 → Super Bowl 50 (DEN def. CAR)
    { seasonStart: "2016-08-11", seasonEnd: "2017-02-05" }, // 2016 → Super Bowl LI (NE def. ATL)
    { seasonStart: "2017-08-03", seasonEnd: "2018-02-04" }, // 2017 → Super Bowl LII (PHI def. NE)
    { seasonStart: "2018-08-02", seasonEnd: "2019-02-03" }, // 2018 → Super Bowl LIII (NE def. LAR)
    { seasonStart: "2019-08-01", seasonEnd: "2020-02-02" }, // 2019 → Super Bowl LIV (KC def. SF)
    { seasonStart: "2020-08-06", seasonEnd: "2021-02-07" }, // 2020 → Super Bowl LV (TB def. KC)
    { seasonStart: "2021-08-05", seasonEnd: "2022-02-13" }, // 2021 → Super Bowl LVI (LAR def. CIN)
    { seasonStart: "2022-08-04", seasonEnd: "2023-02-12" }, // 2022 → Super Bowl LVII (KC def. PHI)
    { seasonStart: "2023-08-03", seasonEnd: "2024-02-11" }, // 2023 → Super Bowl LVIII (KC def. SF) — rerun to fix missing stats
  ],
};

// CLI: node historicalUpsert.js [league] [seasonStart]
// Examples:
//   node historicalUpsert.js                    # all leagues, all seasons
//   node historicalUpsert.js nhl                # all NHL seasons
//   node historicalUpsert.js nhl 2015-09-15     # single NHL season starting 2015-09-15
const args = process.argv.slice(2);
const leagueFilter = args[0] || null;
const seasonFilter = args[1] || null;

(async () => {
  try {
    const entries = Object.entries(leagueSeasons)
      .filter(([slug]) => !leagueFilter || slug === leagueFilter);

    if (entries.length === 0) {
      log.error({ leagueFilter }, "unknown league — expected nba, nfl, or nhl");
      process.exit(1);
    }

    await Promise.all(
      entries.map(async ([slug, seasons]) => {
        const filtered = seasonFilter
          ? seasons.filter((s) => s.seasonStart === seasonFilter)
          : seasons;

        if (filtered.length === 0) {
          log.warn({ league: slug, seasonFilter }, "no matching season found");
          return;
        }

        for (const { seasonStart, seasonEnd } of filtered) {
          log.info({ league: slug, seasonStart, seasonEnd }, "starting season");
          const dates = getAllDatesInRange(seasonStart, seasonEnd);
          await runDateRangeProcessing(slug, dates, pool, {
            batchSize: 2,
            batchDelayMs: 500,
          });
        }
      }),
    );

    const cacheStats = getPlayerCacheStats();
    log.info({ cacheSize: cacheStats.size }, "player cache stats");
    clearPlayerCache();
  } catch (err) {
    log.error({ err }, "fatal error");
  } finally {
    clearPlayerCache();
    await pool.end();
    process.exit(0);
  }
})();
