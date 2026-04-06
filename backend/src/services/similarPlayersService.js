import pool from "../db/db.js";
import { cached } from "../cache/cache.js";
import { getCurrentSeason } from "../cache/seasons.js";
import {
  getNbaGroup,
  getNflGroup,
  getNhlGroup,
  NBA_POSITION_GROUPS,
  NFL_POSITION_GROUPS,
  NHL_POSITION_GROUPS,
} from "../ingestion/computePlayerEmbeddings.js";

async function similarPlayersTTL(league, season) {
  const currentSeason = await getCurrentSeason(league);
  return season === currentSeason ? 120 : 30 * 86400;
}

// Returns the SQL array literal for all positions in a group, e.g. "ARRAY['QB']"
function positionArrayLiteral(positions) {
  return `ARRAY[${positions.map((p) => `'${p}'`).join(",")}]`;
}

export async function getSimilarPlayers(playerId, league, season, limit = 5) {
  const ttl = await similarPlayersTTL(league, season);
  return cached(
    `similarPlayers:${league}:${playerId}:${season}`,
    ttl,
    async () => {
      // 1. Fetch target player's embedding and position
      const targetRes = await pool.query(
        `SELECT pse.embedding::text, pse.embedding, p.position
         FROM player_stat_embeddings pse
         JOIN players p ON pse.player_id = p.id
         WHERE pse.player_id = $1 AND pse.league = $2 AND pse.season = $3`,
        [playerId, league, season]
      );

      if (targetRes.rows.length === 0) return [];

      const targetRow = targetRes.rows[0];
      // embedding comes back as a string like "[0.1,0.2,...]" from pg
      const embeddingStr = targetRow.embedding;
      const position = targetRow.position;

      // 2. Build position filter clause
      let positionFilter = "";
      if (league === "nba" && position) {
        const group = getNbaGroup(position);
        if (group) {
          const positions = NBA_POSITION_GROUPS[group];
          positionFilter = `AND p.position = ANY(${positionArrayLiteral(positions)})`;
        }
      } else if (league === "nfl" && position) {
        const group = getNflGroup(position);
        if (group) {
          const positions = NFL_POSITION_GROUPS[group];
          positionFilter = `AND p.position = ANY(${positionArrayLiteral(positions)})`;
        }
      } else if (league === "nhl" && position) {
        const group = getNhlGroup(position);
        if (group) {
          const positions = NHL_POSITION_GROUPS[group];
          positionFilter = `AND p.position = ANY(${positionArrayLiteral(positions)})`;
        }
      }

      // Use a client + SET LOCAL so the planner uses a sequential scan instead of
      // the HNSW index. HNSW post-filters after exploring only ef_search candidates
      // (default 40) across all seasons — with ~10 seasons in the table only ~1/10
      // of explored candidates match a given season, so it frequently returns fewer
      // than LIMIT results. The table is small enough (~4k rows) that seqscan is fast.
      const client = await pool.connect();
      let rows;
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL enable_indexscan = off");

        const neighborQuery = (extraFilter, params) => client.query(
          `SELECT
             p.id,
             p.name,
             p.image_url AS "imageUrl",
             p.position,
             t.shortname AS "teamShortName",
             t.logo_url AS "teamLogoUrl",
             ROUND((1 - (pse.embedding <=> $1::vector))::numeric, 3) AS similarity
           FROM player_stat_embeddings pse
           JOIN players p ON pse.player_id = p.id
           LEFT JOIN teams t ON p.teamid = t.id
           WHERE pse.league = $2
             AND pse.season = $3
             AND pse.player_id != $4
             ${extraFilter}
           ORDER BY pse.embedding <=> $1::vector
           LIMIT $5`,
          params
        );

        // 3. Find nearest neighbors within position group
        ({ rows } = await neighborQuery(positionFilter, [embeddingStr, league, season, playerId, limit]));

        // 4. If the position filter didn't fill the limit, top up from the full pool
        if (rows.length < limit && positionFilter) {
          const returnedIds = rows.map((r) => r.id);
          const excludeFilter = returnedIds.length > 0
            ? `AND pse.player_id != ALL(ARRAY[${returnedIds.join(",")}])`
            : "";
          const { rows: extras } = await neighborQuery(
            excludeFilter,
            [embeddingStr, league, season, playerId, limit - rows.length]
          );
          rows.push(...extras);
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      return rows;
    },
    { cacheIf: (data) => data?.length > 0 }
  );
}
