import pool from "../../../../db/db.js";

// Career team timeline derived from stats.teamid (recorded at game time).
// Groups consecutive games by team into spans { team, season range, gameCount, firstDate, lastDate }.
export async function getPlayerTeamHistory({ league, playerId }) {
  if (!league || !playerId) return { error: "league and playerId required" };

  const { rows } = await pool.query(
    `SELECT g.date, g.season,
            COALESCE(s.teamid, p.teamid) AS team_id,
            t.shortname, t.name AS team_name
     FROM stats s
     JOIN games g ON g.id = s.gameid
     JOIN players p ON p.id = s.playerid
     LEFT JOIN teams t ON t.id = COALESCE(s.teamid, p.teamid)
     WHERE s.playerid = $1 AND g.league = $2
       AND g.status ILIKE 'Final%'
     ORDER BY g.date ASC`,
    [playerId, league],
  );

  if (rows.length === 0) {
    return { league, playerId, spans: [], note: "No game history found in database (back to 2015-16)." };
  }

  // Collapse consecutive same-team rows into spans
  const spans = [];
  for (const r of rows) {
    const last = spans[spans.length - 1];
    if (last && last.teamId === r.team_id) {
      last.lastDate = r.date;
      last.lastSeason = r.season;
      last.games += 1;
    } else {
      spans.push({
        teamId: r.team_id,
        team: r.shortname,
        teamName: r.team_name,
        firstDate: r.date,
        lastDate: r.date,
        firstSeason: r.season,
        lastSeason: r.season,
        games: 1,
      });
    }
  }

  return {
    league,
    playerId,
    spans,
    note: spans.length > 1
      ? `Player has played for ${spans.length} teams in the database. Trade/move dates are inferred from first game with new team.`
      : "Single-team history in database.",
  };
}
