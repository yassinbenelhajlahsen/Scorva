import pool from "../db/db.js";
import { cached } from "../cache/cache.js";
import { getCurrentSeason } from "../cache/seasons.js";
import {
  getNflGroup,
  getNhlGroup,
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
      if (league === "nfl" && position) {
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

      // 3. Find nearest neighbors
      const { rows } = await pool.query(
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
           ${positionFilter}
         ORDER BY pse.embedding <=> $1::vector
         LIMIT $5`,
        [embeddingStr, league, season, playerId, limit]
      );

      return rows;
    },
    { cacheIf: (data) => data?.length > 0 }
  );
}
