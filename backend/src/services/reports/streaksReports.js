import pool from "../../db/db.js";
import logger from "../../logger.js";

const log = logger.child({ module: "streaksReports" });

function slugForName(name) {
  return name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

const FEED_SQL = `
  SELECT se.subject_type,
         se.subject_id,
         se.stat_label,
         se.length,
         se.start_game_date,
         se.last_game_date,
         p.name           AS player_name,
         p.image_url      AS player_image,
         t.name           AS team_name,
         t.location       AS team_location,
         t.shortname      AS team_shortname,
         t.logo_url       AS team_logo,
         t.abbreviation   AS team_abbr
  FROM streak_events se
  LEFT JOIN players p ON se.subject_type = 'player' AND p.id = se.subject_id
  LEFT JOIN teams   t ON se.subject_type = 'team'   AND t.id = se.subject_id
  WHERE se.league = $1
    AND se.last_game_date > CURRENT_DATE - INTERVAL '30 days'
  ORDER BY se.last_game_date DESC, se.length DESC
  LIMIT 50
`;

function statSlug(label) {
  return label.replace(/\s+/g, "-").toLowerCase();
}

function isoDate(d) {
  if (!d) return null;
  return new Date(d).toISOString();
}

function dateOnly(d) {
  if (!d) return "";
  const s = typeof d === "string" ? d : new Date(d).toISOString();
  return s.slice(0, 10);
}

function mapRow(r, league) {
  const idBase = `streak-${r.subject_type}-${r.subject_id}-${statSlug(r.stat_label)}-${dateOnly(r.start_game_date)}`;
  const date = isoDate(r.last_game_date);
  const base = {
    id: idBase,
    type: "streak",
    date,
    league,
    streakLength: r.length,
    statLabel: r.stat_label,
  };
  if (r.subject_type === "player") {
    return {
      ...base,
      emoji: "🔥",
      player: {
        id: r.subject_id,
        name: r.player_name,
        slug: slugForName(r.player_name || ""),
        imageUrl: r.player_image,
        league,
      },
    };
  }
  return {
    ...base,
    emoji: r.stat_label === "win" ? "🔥" : "❄️",
    team: {
      id: r.subject_id,
      name: r.team_name,
      location: r.team_location,
      shortname: r.team_shortname,
      abbreviation: r.team_abbr,
      logoUrl: r.team_logo,
      league,
    },
  };
}

export async function getStreaksForLeague(league) {
  try {
    const result = await pool.query(FEED_SQL, [league]);
    return result.rows.map((r) => mapRow(r, league));
  } catch (err) {
    log.warn({ err: err?.message, league }, "streaks query failed");
    return [];
  }
}
