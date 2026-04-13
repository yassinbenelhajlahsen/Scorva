const EPSILON = 1e-9;

function getRecord(matrix, teamId, opponentId) {
  return matrix.get(teamId)?.get(opponentId) ?? { wins: 0, losses: 0, pf: 0, pa: 0 };
}

export function buildH2HMatrix(games, confByTeamId) {
  const matrix = new Map();
  const teamTotals = new Map();
  const confRecords = new Map();

  function ensure(teamId, opponentId) {
    if (!matrix.has(teamId)) matrix.set(teamId, new Map());
    const row = matrix.get(teamId);
    if (!row.has(opponentId)) row.set(opponentId, { wins: 0, losses: 0, pf: 0, pa: 0 });
    if (!teamTotals.has(teamId)) teamTotals.set(teamId, { pf: 0, pa: 0 });
  }

  for (const g of games) {
    const home = g.hometeamid;
    const away = g.awayteamid;
    const hs = Number(g.homescore) || 0;
    const as = Number(g.awayscore) || 0;

    ensure(home, away);
    ensure(away, home);

    const homeRec = matrix.get(home).get(away);
    const awayRec = matrix.get(away).get(home);

    homeRec.pf += hs;
    homeRec.pa += as;
    awayRec.pf += as;
    awayRec.pa += hs;

    const totHome = teamTotals.get(home);
    const totAway = teamTotals.get(away);
    totHome.pf += hs;
    totHome.pa += as;
    totAway.pf += as;
    totAway.pa += hs;

    if (g.winnerid === home) {
      homeRec.wins++;
      awayRec.losses++;
    } else if (g.winnerid === away) {
      awayRec.wins++;
      homeRec.losses++;
    }

    // Conference records
    if (confByTeamId) {
      const homeConf = confByTeamId.get(home);
      const awayConf = confByTeamId.get(away);
      if (homeConf && awayConf && homeConf === awayConf) {
        if (!confRecords.has(home)) confRecords.set(home, { wins: 0, losses: 0 });
        if (!confRecords.has(away)) confRecords.set(away, { wins: 0, losses: 0 });
        if (g.winnerid === home) {
          confRecords.get(home).wins++;
          confRecords.get(away).losses++;
        } else if (g.winnerid === away) {
          confRecords.get(away).wins++;
          confRecords.get(home).losses++;
        }
      }
    }
  }

  const teamPointDiffs = new Map();
  for (const [id, t] of teamTotals) {
    teamPointDiffs.set(id, t.pf - t.pa);
  }

  return { matrix, teamPointDiffs, confRecords };
}

function primaryValue(team, league) {
  const w = Number(team.wins) || 0;
  const l = Number(team.losses) || 0;
  const otl = Number(team.otl) || 0;
  const gp = w + l;
  if (gp === 0) return 0;
  if (league === "nhl") return (2 * w + otl) / (2 * gp);
  return w / gp;
}

function resolveGroup(group, matrix) {
  if (group.length <= 1) return group;

  if (group.length === 2) {
    const [a, b] = group;
    const rec = getRecord(matrix, a.id, b.id);
    if (rec.wins !== rec.losses) return rec.wins > rec.losses ? [a, b] : [b, a];
    const aConf = a.confWinPct ?? 0;
    const bConf = b.confWinPct ?? 0;
    if (Math.abs(aConf - bConf) > EPSILON) return aConf > bConf ? [a, b] : [b, a];
    const aDiff = a.pointDiff ?? 0;
    const bDiff = b.pointDiff ?? 0;
    if (aDiff !== bDiff) return aDiff > bDiff ? [a, b] : [b, a];
    return a.id < b.id ? [a, b] : [b, a];
  }

  // 3+ way tie: combined H2H record against all other tied teams
  const groupIds = new Set(group.map((t) => t.id));
  const scored = group.map((team) => {
    let h2hWins = 0;
    let h2hLosses = 0;
    for (const otherId of groupIds) {
      if (otherId === team.id) continue;
      const rec = getRecord(matrix, team.id, otherId);
      h2hWins += rec.wins;
      h2hLosses += rec.losses;
    }
    const h2hGp = h2hWins + h2hLosses;
    const h2hPct = h2hGp > 0 ? h2hWins / h2hGp : 0;
    return { team, h2hPct };
  });

  scored.sort((a, b) =>
    (b.h2hPct - a.h2hPct) ||
    ((b.team.confWinPct ?? 0) - (a.team.confWinPct ?? 0)) ||
    ((b.team.pointDiff ?? 0) - (a.team.pointDiff ?? 0)) ||
    (a.team.id - b.team.id)
  );

  return scored.map((s) => s.team);
}

export function sortWithTiebreakers(teams, matrix, league) {
  const sorted = [...teams];
  sorted.forEach((t) => {
    t._pv = primaryValue(t, league);
  });
  sorted.sort((a, b) => b._pv - a._pv);

  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && Math.abs(sorted[j]._pv - sorted[i]._pv) < EPSILON) {
      j++;
    }
    const group = sorted.slice(i, j);
    result.push(...resolveGroup(group, matrix));
    i = j;
  }

  for (const t of result) delete t._pv;
  return result;
}
