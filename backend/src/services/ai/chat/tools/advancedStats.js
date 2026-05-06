import pool from "../../../../db/db.js";

// Parses "made-attempted" string like "10-20" → { made, att }. Returns null if invalid.
function parseMadeAtt(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const made = parseInt(m[1], 10);
  const att = parseInt(m[2], 10);
  if (Number.isNaN(made) || Number.isNaN(att)) return null;
  return { made, att };
}

// NBA-only derived rate stats (TS%, eFG%, FT rate). VORP/BPM/PER/Corsi are NOT
// derivable from our schema — this tool intentionally does not provide them.
export async function getAdvancedStats({ league, playerId, season, seasonStart, seasonEnd }) {
  if (league !== "nba") {
    return {
      error: "Advanced rate stats are NBA-only in this tool. NHL Corsi/Fenwick and NFL EPA require data we don't store.",
    };
  }
  if (!playerId) return { error: "playerId required" };

  const params = [playerId, league];
  const where = [
    "s.playerid = $1",
    "g.league = $2",
    "g.status ILIKE 'Final%'",
    "g.type IN ('regular', 'makeup', 'playoff')",
    "s.minutes > 0",
  ];

  if (season) {
    params.push(season);
    where.push(`g.season = $${params.length}`);
  } else {
    if (seasonStart) {
      params.push(seasonStart);
      where.push(`g.season >= $${params.length}`);
    }
    if (seasonEnd) {
      params.push(seasonEnd);
      where.push(`g.season <= $${params.length}`);
    }
  }

  const { rows } = await pool.query(
    `SELECT s.points, s.fg, s.threept, s.ft, s.minutes
     FROM stats s
     JOIN games g ON g.id = s.gameid
     WHERE ${where.join(" AND ")}`,
    params,
  );

  if (rows.length === 0) {
    return { error: "No games found for this player in the requested span." };
  }

  let pts = 0;
  let fgm = 0,
    fga = 0;
  let tpm = 0,
    tpa = 0;
  let ftm = 0,
    fta = 0;
  let games = 0;
  let minutes = 0;

  for (const r of rows) {
    const fg = parseMadeAtt(r.fg);
    const tp = parseMadeAtt(r.threept);
    const ft = parseMadeAtt(r.ft);
    if (!fg) continue;
    games += 1;
    pts += r.points || 0;
    minutes += r.minutes || 0;
    fgm += fg.made;
    fga += fg.att;
    if (tp) {
      tpm += tp.made;
      tpa += tp.att;
    }
    if (ft) {
      ftm += ft.made;
      fta += ft.att;
    }
  }

  const tsDenom = 2 * (fga + 0.44 * fta);
  const tsPct = tsDenom > 0 ? pts / tsDenom : null;
  const efgPct = fga > 0 ? (fgm + 0.5 * tpm) / fga : null;
  const ftRate = fga > 0 ? fta / fga : null;
  const threePtPct = tpa > 0 ? tpm / tpa : null;
  const ftPct = fta > 0 ? ftm / fta : null;

  const round = (v) => (v == null ? null : Math.round(v * 1000) / 10);

  return {
    league,
    playerId,
    season: season || null,
    seasonStart: season ? null : seasonStart || null,
    seasonEnd: season ? null : seasonEnd || null,
    games,
    minutes,
    points: pts,
    ts_pct: round(tsPct),
    efg_pct: round(efgPct),
    three_pt_pct: round(threePtPct),
    ft_pct: round(ftPct),
    ft_rate: round(ftRate),
    note: "Rate stats only. VORP, BPM, PER, Corsi etc. require data not stored in this database.",
  };
}
