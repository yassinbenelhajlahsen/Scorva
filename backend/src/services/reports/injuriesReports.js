import pool from "../../db/db.js";
import logger from "../../logger.js";

const log = logger.child({ module: "injuriesReports" });

function slugForName(name) {
  return name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

export async function getInjuriesForLeague(league) {
  try {
    const result = await pool.query(
      `SELECT
         h.id::text       AS history_id,
         h.changed_at,
         h.prev_status,
         h.new_status,
         h.new_status_description,
         p.id              AS player_id,
         p.name            AS player_name,
         p.image_url       AS player_image
       FROM player_status_history h
       JOIN players p ON p.id = h.player_id
       WHERE h.league = $1
         AND h.changed_at > NOW() - INTERVAL '30 days'
         AND h.prev_status IS DISTINCT FROM h.new_status
         AND COALESCE(h.prev_status, '') <> 'active'
         AND COALESCE(h.new_status, '') <> 'active'
       ORDER BY h.changed_at DESC
       LIMIT 200`,
      [league]
    );

    return result.rows.map((r) => ({
      id: `injury-${r.history_id}`,
      type: "injury",
      date: new Date(r.changed_at).toISOString(),
      league,
      player: {
        id: r.player_id,
        name: r.player_name,
        slug: slugForName(r.player_name),
        imageUrl: r.player_image,
        league,
      },
      prevStatus: r.prev_status,
      newStatus: r.new_status,
      newStatusDescription: r.new_status_description,
    }));
  } catch (err) {
    log.warn({ err: err?.message, league }, "injuries query failed");
    return [];
  }
}
