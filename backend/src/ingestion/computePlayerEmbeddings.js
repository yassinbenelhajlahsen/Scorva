import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../logger.js";
import { getCurrentSeason } from "../cache/seasons.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

const log = logger.child({ worker: "computePlayerEmbeddings" });

// Position groups for filtering similarity queries at compute time (stored in the vector)
// and at query time (see similarPlayersService.js).
// NBA positions are not grouped — modern NBA is positionless and clusters naturally.
// BIG covers traditional bigs; WING covers guards and wings.
// Intentionally soft — keeps positionless play intact within each group
// while preventing centers from being compared to point guards.
export const NBA_POSITION_GROUPS = {
  BIG:  ["C", "PF", "F-C", "C-F"],
  WING: ["PG", "SG", "SF", "G", "F", "G-F", "F-G", "SF-SG"],
};

export function getNbaGroup(position) {
  if (!position) return null;
  const pos = position.toUpperCase();
  for (const [group, positions] of Object.entries(NBA_POSITION_GROUPS)) {
    if (positions.includes(pos)) return group;
  }
  return null;
}

export const NFL_POSITION_GROUPS = {
  QB: ["QB"],
  RB: ["RB", "FB"],
  WR: ["WR", "TE"],
  DEF: ["CB", "S", "SS", "FS", "LB", "OLB", "ILB", "MLB", "DE", "DT", "NT", "DL"],
};

export const NHL_POSITION_GROUPS = {
  GOALIE: ["G"],
  SKATER: ["C", "LW", "RW", "D", "F", "W"],
};

// Returns the group key for a position, or null if not found
export function getNflGroup(position) {
  if (!position) return null;
  const pos = position.toUpperCase();
  for (const [group, positions] of Object.entries(NFL_POSITION_GROUPS)) {
    if (positions.includes(pos)) return group;
  }
  return null;
}

export function getNhlGroup(position) {
  if (!position) return null;
  const pos = position.toUpperCase();
  for (const [group, positions] of Object.entries(NHL_POSITION_GROUPS)) {
    if (positions.includes(pos)) return group;
  }
  return null;
}

// League config: stat query, number of meaningful dimensions, min games threshold
// All vectors are zero-padded to 14 dims (NHL max) for the single vector(14) column.
const LEAGUE_CONFIGS = {
  nba: {
    dims: 10,
    minGames: 5,
    statQuery: `
      SELECT
        s.playerid,
        p.position,
        COUNT(*)::int AS game_count,
        -- Counting stats normalized to per-36 minutes so playing time
        -- doesn't conflate volume with production rate.
        (AVG(s.points)   / NULLIF(AVG(s.minutes), 0) * 36)::float AS d0,
        (AVG(s.assists)  / NULLIF(AVG(s.minutes), 0) * 36)::float AS d1,
        (AVG(s.rebounds) / NULLIF(AVG(s.minutes), 0) * 36)::float AS d2,
        (AVG(s.blocks)   / NULLIF(AVG(s.minutes), 0) * 36)::float AS d3,
        (AVG(s.steals)   / NULLIF(AVG(s.minutes), 0) * 36)::float AS d4,
        -- Shooting percentages are already rate stats — no per-36 needed.
        (
          SUM(NULLIF(split_part(s.fg, '-', 1), '')::numeric)
          / NULLIF(SUM(NULLIF(split_part(s.fg, '-', 2), '')::numeric), 0)
        )::float AS d5,
        (
          SUM(NULLIF(split_part(s.threept, '-', 1), '')::numeric)
          / NULLIF(SUM(NULLIF(split_part(s.threept, '-', 2), '')::numeric), 0)
        )::float AS d6,
        (
          SUM(NULLIF(split_part(s.ft, '-', 1), '')::numeric)
          / NULLIF(SUM(NULLIF(split_part(s.ft, '-', 2), '')::numeric), 0)
        )::float AS d7,
        (AVG(s.turnovers) / NULLIF(AVG(s.minutes), 0) * 36)::float AS d8,
        AVG(s.plusminus)::float AS d9
      FROM stats s
      JOIN games g ON s.gameid = g.id
      JOIN players p ON s.playerid = p.id
      WHERE p.league = 'nba' AND g.season = $1 AND g.type = 'regular'
        AND s.minutes > 0
      GROUP BY s.playerid, p.position
      HAVING COUNT(*) >= $2 AND AVG(s.minutes) >= 10
    `,
  },
  nfl: {
    dims: 5,
    minGames: 2,
    statQuery: `
      SELECT
        s.playerid,
        p.position,
        COUNT(*)::int AS game_count,
        (
          SUM(NULLIF(split_part(s.cmpatt, '/', 1), '')::numeric)
          / NULLIF(SUM(NULLIF(split_part(s.cmpatt, '/', 2), '')::numeric), 0)
        )::float AS d0,
        AVG(s.yds)::float AS d1,
        AVG(s.td)::float AS d2,
        AVG(s.interceptions)::float AS d3,
        AVG(NULLIF(split_part(s.sacks, '-', 1), '')::numeric)::float AS d4
      FROM stats s
      JOIN games g ON s.gameid = g.id
      JOIN players p ON s.playerid = p.id
      WHERE p.league = 'nfl' AND g.season = $1 AND g.type = 'regular'
      GROUP BY s.playerid, p.position
      HAVING COUNT(*) >= $2
    `,
  },
  nhl: {
    dims: 14,
    minGames: 5,
    statQuery: `
      SELECT
        s.playerid,
        p.position,
        COUNT(*)::int AS game_count,
        AVG(s.g)::float AS d0,
        AVG(s.a)::float AS d1,
        AVG(s.saves)::float AS d2,
        AVG(NULLIF(s.savepct, '')::numeric)::float AS d3,
        AVG(s.ga)::float AS d4,
        AVG(s.shots)::float AS d5,
        AVG(s.sm)::float AS d6,
        AVG(s.bs)::float AS d7,
        AVG(s.pn)::float AS d8,
        AVG(s.pim)::float AS d9,
        AVG(s.ht)::float AS d10,
        AVG(s.tk)::float AS d11,
        AVG(s.gv)::float AS d12,
        AVG(s.plusminus)::float AS d13
      FROM stats s
      JOIN games g ON s.gameid = g.id
      JOIN players p ON s.playerid = p.id
      WHERE p.league = 'nhl' AND g.season = $1 AND g.type = 'regular'
      GROUP BY s.playerid, p.position
      HAVING COUNT(*) >= $2
    `,
  },
};

function computeZScore(rows, dims) {
  // Compute mean and stddev per dimension across all qualifying players
  const means = new Array(dims).fill(0);
  const counts = new Array(dims).fill(0);

  for (const row of rows) {
    for (let i = 0; i < dims; i++) {
      const val = row[`d${i}`];
      if (val != null && !isNaN(val)) {
        means[i] += val;
        counts[i]++;
      }
    }
  }
  for (let i = 0; i < dims; i++) {
    means[i] = counts[i] > 0 ? means[i] / counts[i] : 0;
  }

  const variances = new Array(dims).fill(0);
  for (const row of rows) {
    for (let i = 0; i < dims; i++) {
      const val = row[`d${i}`];
      if (val != null && !isNaN(val)) {
        variances[i] += (val - means[i]) ** 2;
      }
    }
  }
  const stddevs = variances.map((v, i) =>
    counts[i] > 1 ? Math.sqrt(v / counts[i]) : 1
  );

  // Apply z-score to each row's vector and zero-pad to 14 dims
  return rows.map((row) => {
    const vec = new Array(14).fill(0);
    for (let i = 0; i < dims; i++) {
      const val = row[`d${i}`];
      if (val != null && !isNaN(val) && stddevs[i] > 0) {
        vec[i] = (val - means[i]) / stddevs[i];
      }
    }
    return { playerId: row.playerid, position: row.position, gamesUsed: row.game_count, vec };
  });
}

async function computeLeagueEmbeddings(pool, league, season) {
  const config = LEAGUE_CONFIGS[league];
  const { rows } = await pool.query(config.statQuery, [season, config.minGames]);

  if (rows.length === 0) {
    log.info({ league, season }, "no qualifying players, skipping");
    return 0;
  }

  const normalized = computeZScore(rows, config.dims);

  // Batch upsert
  for (const { playerId, gamesUsed, vec } of normalized) {
    const vecStr = `[${vec.join(",")}]`;
    await pool.query(
      `
      INSERT INTO player_stat_embeddings (player_id, league, season, embedding, games_used, updated_at)
      VALUES ($1, $2, $3, $4::vector, $5, NOW())
      ON CONFLICT (player_id, league, season)
      DO UPDATE SET embedding = EXCLUDED.embedding, games_used = EXCLUDED.games_used, updated_at = NOW()
      `,
      [playerId, league, season, vecStr, gamesUsed]
    );
  }

  return normalized.length;
}

export async function computeAllEmbeddings(pool) {
  const leagues = ["nba", "nfl", "nhl"];
  for (const league of leagues) {
    const season = await getCurrentSeason(league);
    log.info({ league, season }, "computing player embeddings");
    try {
      const count = await computeLeagueEmbeddings(pool, league, season);
      log.info({ league, season, count }, "embeddings upserted");
    } catch (err) {
      log.error({ err, league, season }, "failed computing embeddings");
    }
  }
}

// CLI entry point
if (resolve(process.argv[1]) === __filename) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    await computeAllEmbeddings(pool);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
