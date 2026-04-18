// Shared utilities used by both NBA and NHL playoff services.
// No DB or cache dependencies — pure data-shaping functions.

export function isFinalStatus(status) {
  return typeof status === "string" && /^final/i.test(status);
}

export function pairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function buildSeries(games, teamsById, { bestOf = 7 } = {}) {
  const winsNeeded = Math.ceil(bestOf / 2);
  const seriesMap = new Map();

  for (const g of games) {
    if (!g.hometeamid || !g.awayteamid) continue;
    const key = pairKey(g.hometeamid, g.awayteamid);
    let series = seriesMap.get(key);
    if (!series) {
      const teamA = Math.min(g.hometeamid, g.awayteamid);
      const teamB = Math.max(g.hometeamid, g.awayteamid);
      series = {
        teamAId: teamA,
        teamBId: teamB,
        games: [],
        wins: { [teamA]: 0, [teamB]: 0 },
        firstGameDate: null,
        lastGameDate: null,
        hasFinalTypeGame: false,
        hasPlayInLabel: false,
      };
      seriesMap.set(key, series);
    }
    series.games.push({
      id: g.id,
      date: g.date,
      homeTeamId: g.hometeamid,
      awayTeamId: g.awayteamid,
      homescore: g.homescore,
      awayscore: g.awayscore,
      winnerid: g.winnerid,
      status: g.status,
      type: g.type,
      game_label: g.game_label ?? null,
    });
    if (
      isFinalStatus(g.status) &&
      g.winnerid != null &&
      series.wins[g.winnerid] !== undefined
    ) {
      series.wins[g.winnerid] += 1;
    }
    if (g.type === "final") series.hasFinalTypeGame = true;
    if (g.is_playin) series.hasPlayInLabel = true;
  }

  const seriesList = [];
  for (const series of seriesMap.values()) {
    series.games.sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      return ad - bd || a.id - b.id;
    });
    series.firstGameDate = series.games[0]?.date ?? null;
    series.lastGameDate = series.games[series.games.length - 1]?.date ?? null;

    const a = series.wins[series.teamAId];
    const b = series.wins[series.teamBId];
    series.winnerId = a > b ? series.teamAId : b > a ? series.teamBId : null;
    series.isComplete = a >= winsNeeded || b >= winsNeeded;

    const rawConfA = teamsById.get(series.teamAId)?.conf ?? null;
    const rawConfB = teamsById.get(series.teamBId)?.conf ?? null;
    // ESPN creates placeholder teams (e.g. "Suns/Trail Blazers") for
    // undecided play-in slots. These have no conference — inherit from
    // the known opponent so the series isn't dropped.
    series.confA = rawConfA || rawConfB;
    series.confB = rawConfB || rawConfA;
    series.isInterConference =
      rawConfA && rawConfB && rawConfA !== rawConfB;

    seriesList.push(series);
  }

  return seriesList;
}

export function makeTeamInfo(teamId, teamsById, seedMap) {
  const t = teamsById.get(teamId);
  // ESPN placeholder teams (e.g. "Suns/Trail Blazers" for undecided
  // play-in slots) have no conference — treat as TBD.
  if (!t || !t.conf) return null;
  return {
    id: t.id,
    seed: seedMap?.get(teamId) ?? null,
    name: t.name,
    shortname: t.shortname,
    location: t.location,
    logo_url: t.logo_url,
    primary_color: t.primary_color,
    conf: t.conf,
    record: `${t.wins}-${t.losses}`,
  };
}

export function projectedTeamInfo(team, seed) {
  return {
    id: team.id,
    seed,
    name: team.name,
    shortname: team.shortname,
    location: team.location,
    logo_url: team.logo_url,
    primary_color: team.primary_color,
    conf: team.conf,
    record: `${team.wins}-${team.losses}`,
  };
}

export function serializeSeries(series, { round, conference, teamsById, seedMap }) {
  let teamA = makeTeamInfo(series.teamAId, teamsById, seedMap);
  let teamB = makeTeamInfo(series.teamBId, teamsById, seedMap);

  // Higher seed (lower number) on top; if seeds match (e.g. Finals),
  // fall back to better regular-season record.
  if (teamA && teamB) {
    const sA = teamA.seed;
    const sB = teamB.seed;
    if (sA && sB && sA !== sB && sB < sA) {
      [teamA, teamB] = [teamB, teamA];
    } else if ((!sA || !sB || sA === sB) && teamA.record && teamB.record) {
      const winsA = parseInt(teamA.record, 10);
      const winsB = parseInt(teamB.record, 10);
      if (winsB > winsA) {
        [teamA, teamB] = [teamB, teamA];
      }
    }
  }

  return {
    round,
    conference,
    teamA,
    teamB,
    wins: {
      [series.teamAId]: series.wins[series.teamAId],
      [series.teamBId]: series.wins[series.teamBId],
    },
    games: series.games.map((g) => ({
      id: g.id,
      date: g.date,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homescore: g.homescore,
      awayscore: g.awayscore,
      winnerid: g.winnerid,
      status: g.status,
    })),
    winnerId: series.winnerId,
    isComplete: series.isComplete,
  };
}

export function emptySeries({ round, conference, teamA, teamB, playInTier = null }) {
  return {
    round,
    conference,
    teamA,
    teamB,
    wins: teamA && teamB ? { [teamA.id]: 0, [teamB.id]: 0 } : {},
    games: [],
    winnerId: null,
    isComplete: false,
    ...(playInTier != null && { playInTier }),
  };
}

export function emptyConfBlock(confKey) {
  return {
    r1: Array.from({ length: 4 }, () =>
      emptySeries({ round: "r1", conference: confKey, teamA: null, teamB: null })
    ),
    semis: Array.from({ length: 2 }, () =>
      emptySeries({ round: "semis", conference: confKey, teamA: null, teamB: null })
    ),
    confFinals: [
      emptySeries({ round: "confFinals", conference: confKey, teamA: null, teamB: null }),
    ],
  };
}

export function padConfBlock(block, confKey) {
  const expected = { r1: 4, semis: 2, confFinals: 1 };
  for (const [round, count] of Object.entries(expected)) {
    while (block[round].length < count) {
      block[round].push(
        emptySeries({ round, conference: confKey, teamA: null, teamB: null })
      );
    }
  }
}

// Clear downstream rounds until predecessors are complete.
// Prevents pre-created ESPN semi/CF game rows from leaking into the bracket
// before the preceding round has actually been decided.
export function clearDownstream(block, confKey) {
  const r1Done = block.r1.some((s) => s.isComplete);
  if (!r1Done) {
    block.semis = Array.from({ length: 2 }, () =>
      emptySeries({ round: "semis", conference: confKey, teamA: null, teamB: null })
    );
  }
  const semisDone = block.semis.some((s) => s.isComplete);
  if (!semisDone) {
    block.confFinals = [
      emptySeries({ round: "confFinals", conference: confKey, teamA: null, teamB: null }),
    ];
  }
}
