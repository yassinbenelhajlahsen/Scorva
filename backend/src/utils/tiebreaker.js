const EPSILON = 1e-9;

function getRecord(matrix, teamId, opponentId) {
  return matrix.get(teamId)?.get(opponentId) ?? { wins: 0, losses: 0, pf: 0, pa: 0, otLosses: 0 };
}

// league is optional; when "nhl", tracks regWins per team and otLosses per pair.
export function buildH2HMatrix(games, confByTeamId, league) {
  const matrix = new Map();
  const teamTotals = new Map();
  const confRecords = new Map();

  function ensure(teamId, opponentId) {
    if (!matrix.has(teamId)) matrix.set(teamId, new Map());
    const row = matrix.get(teamId);
    if (!row.has(opponentId)) {
      row.set(opponentId, { wins: 0, losses: 0, pf: 0, pa: 0, otLosses: 0 });
    }
    if (!teamTotals.has(teamId)) {
      teamTotals.set(teamId, { pf: 0, pa: 0, regWins: 0 });
    }
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
      if (league === "nhl") {
        // ot1 IS NOT NULL means the game went to OT or SO
        if (g.ot1 != null) {
          awayRec.otLosses++;
        } else {
          totHome.regWins++;
        }
      }
    } else if (g.winnerid === away) {
      awayRec.wins++;
      homeRec.losses++;
      if (league === "nhl") {
        if (g.ot1 != null) {
          homeRec.otLosses++;
        } else {
          totAway.regWins++;
        }
      }
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
  const teamRegWins = new Map();
  const teamGf = new Map();
  for (const [id, t] of teamTotals) {
    teamPointDiffs.set(id, t.pf - t.pa);
    teamRegWins.set(id, t.regWins);
    teamGf.set(id, t.pf);
  }

  return { matrix, teamPointDiffs, teamRegWins, teamGf, confRecords };
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

// NHL 4-step tiebreaker within a tied group (all have equal ptsPct):
//   1. regWins (wins where ot1 IS NULL) desc
//   2. H2H pts against tied group (2/win, 1/OT-SO-loss, 0/reg-loss) desc
//   3. goal differential (overall) desc
//   4. goals for (overall) desc
//   5. id asc (deterministic)
function nhlResolveGroup(group, matrix) {
  if (group.length <= 1) return group;

  const groupIds = new Set(group.map((t) => t.id));

  const scored = group.map((team) => {
    let h2hPts = 0;
    for (const otherId of groupIds) {
      if (otherId === team.id) continue;
      const rec = getRecord(matrix, team.id, otherId);
      h2hPts += rec.wins * 2 + rec.otLosses;
    }
    return { team, h2hPts };
  });

  scored.sort((a, b) =>
    ((b.team.regWins ?? 0) - (a.team.regWins ?? 0)) ||
    (b.h2hPts - a.h2hPts) ||
    ((b.team.pointDiff ?? 0) - (a.team.pointDiff ?? 0)) ||
    ((b.team.gf ?? 0) - (a.team.gf ?? 0)) ||
    (a.team.id - b.team.id)
  );

  return scored.map((s) => s.team);
}

// NBA/NFL tiebreaker cascade (no division-leader step):
//   2-way: H2H → conf% → point diff → id
//   3+way: combined H2H pct → conf% → point diff → id
// Used both as the base fallback and for computing division leaders (no recursion).
function resolveGroupBase(group, matrix) {
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

// Determine the division leader for each division in the passed team list.
// Uses resolveGroupBase (no division-leader step) to avoid recursion.
// Returns a Set of team IDs that lead their respective divisions.
function computeDivisionLeaders(teams, matrix) {
  const byDivision = new Map();
  for (const t of teams) {
    if (!t.division) continue;
    if (!byDivision.has(t.division)) byDivision.set(t.division, []);
    byDivision.get(t.division).push(t);
  }

  const leaders = new Set();
  for (const divTeams of byDivision.values()) {
    if (divTeams.length === 0) continue;
    const withPv = divTeams.map((t) => ({ t, pv: primaryValue(t, "nba") }));
    withPv.sort((a, b) => b.pv - a.pv);
    const bestPv = withPv[0].pv;
    let j = 1;
    while (j < withPv.length && Math.abs(withPv[j].pv - bestPv) < EPSILON) j++;
    const topGroup = withPv.slice(0, j).map((x) => x.t);
    const resolved = resolveGroupBase(topGroup, matrix);
    leaders.add(resolved[0].id);
  }
  return leaders;
}

function resolveGroup(group, matrix, league, divLeaders) {
  if (group.length <= 1) return group;

  if (league === "nhl") return nhlResolveGroup(group, matrix);

  if (group.length === 2) {
    const [a, b] = group;
    // H2H
    const rec = getRecord(matrix, a.id, b.id);
    if (rec.wins !== rec.losses) return rec.wins > rec.losses ? [a, b] : [b, a];
    // NBA division-leader bonus: after H2H, before conf%
    if (divLeaders) {
      const aL = divLeaders.has(a.id);
      const bL = divLeaders.has(b.id);
      if (aL && !bL) return [a, b];
      if (bL && !aL) return [b, a];
    }
    return resolveGroupBase([a, b], matrix);
  }

  // 3+ way tie: if some leaders and some non-leaders exist, rank leaders first.
  // Each partition is then resolved independently by resolveGroupBase.
  if (divLeaders) {
    const leaders = group.filter((t) => divLeaders.has(t.id));
    const nonLeaders = group.filter((t) => !divLeaders.has(t.id));
    if (leaders.length > 0 && nonLeaders.length > 0) {
      return [
        ...resolveGroupBase(leaders, matrix),
        ...resolveGroupBase(nonLeaders, matrix),
      ];
    }
  }

  return resolveGroupBase(group, matrix);
}

export function sortWithTiebreakers(teams, matrix, league) {
  const sorted = [...teams];
  sorted.forEach((t) => {
    t._pv = primaryValue(t, league);
  });
  sorted.sort((a, b) => b._pv - a._pv);

  // Compute NBA division leaders once for this sort pass. Skip for NHL (uses its
  // own cascade) and when no teams carry a division field (e.g. NFL for now).
  const hasDivisions = league !== "nhl" && teams.some((t) => t.division);
  const divLeaders = hasDivisions ? computeDivisionLeaders(sorted, matrix) : null;

  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && Math.abs(sorted[j]._pv - sorted[i]._pv) < EPSILON) {
      j++;
    }
    const group = sorted.slice(i, j);
    result.push(...resolveGroup(group, matrix, league, divLeaders));
    i = j;
  }

  for (const t of result) delete t._pv;
  return result;
}
