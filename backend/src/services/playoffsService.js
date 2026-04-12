import pool from "../db/db.js";
import { cached } from "../cache/cache.js";
import { getCurrentSeason } from "../cache/seasons.js";
import { getStandings } from "./standingsService.js";
import logger from "../logger.js";

const R1_SEED_PAIRS = [
  [1, 8],
  [4, 5],
  [3, 6],
  [2, 7],
];

function isFinalStatus(status) {
  return typeof status === "string" && /^final/i.test(status);
}

function pairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

async function fetchPlayoffGames(season) {
  const { rows } = await pool.query(
    `SELECT id, date, hometeamid, awayteamid, homescore, awayscore,
            winnerid, status, type
       FROM games
      WHERE league = 'nba'
        AND season = $1
        AND type IN ('playoff', 'final')
      ORDER BY date ASC, id ASC`,
    [season]
  );
  return rows;
}

function buildSeries(games, teamsById) {
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
    });
    if (g.winnerid != null && series.wins[g.winnerid] !== undefined) {
      series.wins[g.winnerid] += 1;
    }
    if (g.type === "final") series.hasFinalTypeGame = true;
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
    series.isComplete = a >= 4 || b >= 4;

    const confA = teamsById.get(series.teamAId)?.conf ?? null;
    const confB = teamsById.get(series.teamBId)?.conf ?? null;
    series.confA = confA;
    series.confB = confB;
    series.isInterConference = confA && confB && confA !== confB;

    seriesList.push(series);
  }

  return seriesList;
}

// Play-in games: single-elimination series that start strictly before R1
function classifyPlayIn(allSeries) {
  const singleGameSeries = allSeries.filter((s) => s.games.length === 1 && !s.hasFinalTypeGame);
  const multiGameSeries = allSeries.filter((s) => s.games.length > 1 || s.hasFinalTypeGame);

  if (singleGameSeries.length === 0) {
    return { playInSeries: [], remainingSeries: allSeries };
  }

  let earliestR1 = null;
  for (const s of multiGameSeries) {
    const d = s.firstGameDate ? new Date(s.firstGameDate).getTime() : null;
    if (d !== null && (earliestR1 === null || d < earliestR1)) earliestR1 = d;
  }

  const playInSeries = [];
  const kept = [];
  for (const s of singleGameSeries) {
    const d = s.firstGameDate ? new Date(s.firstGameDate).getTime() : null;
    if (earliestR1 === null || (d !== null && d < earliestR1)) {
      playInSeries.push(s);
    } else {
      kept.push(s);
    }
  }

  return {
    playInSeries,
    remainingSeries: [...multiGameSeries, ...kept],
  };
}

function groupByConference(seriesList) {
  const east = [];
  const west = [];
  for (const s of seriesList) {
    if (s.confA === "east" && s.confB === "east") east.push(s);
    else if (s.confA === "west" && s.confB === "west") west.push(s);
  }
  const byDate = (a, b) => new Date(a.firstGameDate).getTime() - new Date(b.firstGameDate).getTime();
  east.sort(byDate);
  west.sort(byDate);
  return { east, west };
}

// R1 = first 4 series by date, Semis = next 2, Conf Finals = last 1
function classifyConferenceRounds(confSeries) {
  return {
    r1: confSeries.slice(0, 4),
    semis: confSeries.slice(4, 6),
    confFinals: confSeries.slice(6, 7),
  };
}

// Rank R1 participants by regular-season wins to infer seeds.
// Validates that inferred seeds produce canonical {1:8, 4:5, 3:6, 2:7} matchups.
function inferSeedsFromR1(r1Series, standingsByConf) {
  if (r1Series.length !== 4) return null;

  const participants = new Set();
  for (const s of r1Series) {
    participants.add(s.teamAId);
    participants.add(s.teamBId);
  }
  if (participants.size !== 8) return null;

  const ranked = Array.from(participants)
    .map((id) => standingsByConf.get(id))
    .filter(Boolean)
    .sort((x, y) => y.wins - x.wins || x.losses - y.losses);

  if (ranked.length !== 8) return null;

  const seedMap = new Map();
  ranked.forEach((t, i) => seedMap.set(t.id, i + 1));

  const valid = new Set(["1-8", "2-7", "3-6", "4-5"]);
  for (const s of r1Series) {
    const sa = seedMap.get(s.teamAId);
    const sb = seedMap.get(s.teamBId);
    if (!sa || !sb) return null;
    const key = sa < sb ? `${sa}-${sb}` : `${sb}-${sa}`;
    if (!valid.has(key)) return null;
  }

  return seedMap;
}

function makeTeamInfo(teamId, teamsById, seedMap) {
  const t = teamsById.get(teamId);
  if (!t) return null;
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

function projectedTeamInfo(team, seed) {
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

function serializeSeries(series, { round, conference, teamsById, seedMap }) {
  const teamA = makeTeamInfo(series.teamAId, teamsById, seedMap);
  const teamB = makeTeamInfo(series.teamBId, teamsById, seedMap);
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

function emptySeries({ round, conference, teamA, teamB }) {
  return {
    round,
    conference,
    teamA,
    teamB,
    wins: teamA && teamB ? { [teamA.id]: 0, [teamB.id]: 0 } : {},
    games: [],
    winnerId: null,
    isComplete: false,
  };
}

function emptyConfBlock(confKey) {
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

function padConfBlock(block, confKey) {
  const expected = { r1: 4, semis: 2, confFinals: 1 };
  for (const [round, count] of Object.entries(expected)) {
    while (block[round].length < count) {
      block[round].push(
        emptySeries({ round, conference: confKey, teamA: null, teamB: null })
      );
    }
  }
}

function buildProjectedConference(conf, teamsById) {
  const confKey = conf === "east" ? "eastern" : "western";

  const teams = Array.from(teamsById.values())
    .filter((t) => t.conf === conf)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  const seededTop8 = teams.slice(0, 8);
  const playIn910 = teams.slice(8, 10);

  if (seededTop8.length < 8) return null;

  const infoBySeed = new Map();
  seededTop8.forEach((t, i) => infoBySeed.set(i + 1, projectedTeamInfo(t, i + 1)));

  const r1 = R1_SEED_PAIRS.map(([a, b]) =>
    emptySeries({
      round: "r1",
      conference: confKey,
      teamA: infoBySeed.get(a),
      teamB: infoBySeed.get(b),
    })
  );

  const semis = Array.from({ length: 2 }, () =>
    emptySeries({ round: "semis", conference: confKey, teamA: null, teamB: null })
  );
  const confFinals = [
    emptySeries({ round: "confFinals", conference: confKey, teamA: null, teamB: null }),
  ];

  const playIn = [];
  if (playIn910.length === 2) {
    playIn.push(
      emptySeries({
        round: "play_in",
        conference: confKey,
        teamA: infoBySeed.get(7),
        teamB: infoBySeed.get(8),
      }),
      emptySeries({
        round: "play_in",
        conference: confKey,
        teamA: projectedTeamInfo(playIn910[0], 9),
        teamB: projectedTeamInfo(playIn910[1], 10),
      })
    );
  }

  return { r1, semis, confFinals, playIn };
}

// Order R1 series to match the canonical [1v8, 4v5, 3v6, 2v7] layout
function orderR1BySeedPairs(r1SerializedList) {
  const byKey = new Map();
  for (const s of r1SerializedList) {
    const sa = s.teamA?.seed;
    const sb = s.teamB?.seed;
    if (!sa || !sb) continue;
    const key = sa < sb ? `${sa}-${sb}` : `${sb}-${sa}`;
    byKey.set(key, s);
  }
  const ordered = [];
  for (const [a, b] of R1_SEED_PAIRS) {
    const key = `${a}-${b}`;
    ordered.push(byKey.get(key) ?? null);
  }
  if (ordered.some((s) => s === null)) {
    return r1SerializedList;
  }
  return ordered;
}

async function derivePlayoffs(season) {
  const [games, rawStandings] = await Promise.all([
    fetchPlayoffGames(season),
    getStandings("nba", season),
  ]);

  const teamsById = new Map();
  for (const r of rawStandings) {
    teamsById.set(r.id, {
      ...r,
      wins: Number(r.wins) || 0,
      losses: Number(r.losses) || 0,
    });
  }

  if (games.length === 0) {
    const east = buildProjectedConference("east", teamsById);
    const west = buildProjectedConference("west", teamsById);
    if (!east || !west) {
      return {
        season,
        isProjected: true,
        playIn: null,
        bracket: {
          eastern: emptyConfBlock("eastern"),
          western: emptyConfBlock("western"),
          finals: [emptySeries({ round: "finals", conference: null, teamA: null, teamB: null })],
        },
      };
    }
    return {
      season,
      isProjected: true,
      playIn: {
        eastern: east.playIn,
        western: west.playIn,
      },
      bracket: {
        eastern: { r1: east.r1, semis: east.semis, confFinals: east.confFinals },
        western: { r1: west.r1, semis: west.semis, confFinals: west.confFinals },
        finals: [emptySeries({ round: "finals", conference: null, teamA: null, teamB: null })],
      },
    };
  }

  const allSeries = buildSeries(games, teamsById);

  const finalsSeries = allSeries.filter((s) => s.hasFinalTypeGame);
  const nonFinalsSeries = allSeries.filter((s) => !s.hasFinalTypeGame);

  const { playInSeries, remainingSeries } = classifyPlayIn(nonFinalsSeries);

  // Play-in is best-of-1 — override the best-of-7 isComplete rule
  for (const s of playInSeries) {
    s.isComplete = s.games.length > 0 && s.games.every((g) => isFinalStatus(g.status));
  }

  const cleanSeries = [];
  for (const s of remainingSeries) {
    if (s.isInterConference) {
      logger.warn(
        { teamA: s.teamAId, teamB: s.teamBId, season },
        "Skipping cross-conference non-final playoff series"
      );
      continue;
    }
    if (!s.confA || !s.confB) {
      logger.warn(
        { teamA: s.teamAId, teamB: s.teamBId, season },
        "Playoff series team missing conference data"
      );
      continue;
    }
    cleanSeries.push(s);
  }

  const { east: eastSeries, west: westSeries } = groupByConference(cleanSeries);
  const eastRounds = classifyConferenceRounds(eastSeries);
  const westRounds = classifyConferenceRounds(westSeries);

  const standingsByConfEast = new Map(
    Array.from(teamsById.values()).filter((t) => t.conf === "east").map((t) => [t.id, t])
  );
  const standingsByConfWest = new Map(
    Array.from(teamsById.values()).filter((t) => t.conf === "west").map((t) => [t.id, t])
  );
  let eastSeedMap = inferSeedsFromR1(eastRounds.r1, standingsByConfEast);
  let westSeedMap = inferSeedsFromR1(westRounds.r1, standingsByConfWest);

  if (!eastSeedMap) {
    eastSeedMap = new Map();
    const ranked = Array.from(standingsByConfEast.values()).sort(
      (a, b) => b.wins - a.wins || a.losses - b.losses
    );
    ranked.forEach((t, i) => eastSeedMap.set(t.id, i + 1));
    logger.debug({ season }, "East seed inference failed, using standings fallback");
  }
  if (!westSeedMap) {
    westSeedMap = new Map();
    const ranked = Array.from(standingsByConfWest.values()).sort(
      (a, b) => b.wins - a.wins || a.losses - b.losses
    );
    ranked.forEach((t, i) => westSeedMap.set(t.id, i + 1));
    logger.debug({ season }, "West seed inference failed, using standings fallback");
  }

  const seedMapById = new Map([...eastSeedMap, ...westSeedMap]);
  const ctx = { teamsById, seedMap: seedMapById };

  const serializeConf = (rounds, confKey) => ({
    r1: orderR1BySeedPairs(
      rounds.r1.map((s) => serializeSeries(s, { ...ctx, round: "r1", conference: confKey }))
    ),
    semis: rounds.semis.map((s) =>
      serializeSeries(s, { ...ctx, round: "semis", conference: confKey })
    ),
    confFinals: rounds.confFinals.map((s) =>
      serializeSeries(s, { ...ctx, round: "confFinals", conference: confKey })
    ),
  });

  const easternBlock = serializeConf(eastRounds, "eastern");
  const westernBlock = serializeConf(westRounds, "western");

  padConfBlock(easternBlock, "eastern");
  padConfBlock(westernBlock, "western");

  const finals =
    finalsSeries.length > 0
      ? finalsSeries.map((s) =>
          serializeSeries(s, { ...ctx, round: "finals", conference: null })
        )
      : [emptySeries({ round: "finals", conference: null, teamA: null, teamB: null })];

  // Show play-in if any game is incomplete or R1 hasn't started yet
  let showPlayIn = false;
  if (playInSeries.length > 0) {
    const anyIncomplete = playInSeries.some(
      (s) => !s.games.every((g) => isFinalStatus(g.status))
    );
    const r1Started = eastRounds.r1.length > 0 || westRounds.r1.length > 0;
    showPlayIn = anyIncomplete || !r1Started;
  }

  let playInBlock = null;
  if (showPlayIn) {
    const byConf = { eastern: [], western: [] };
    for (const s of playInSeries) {
      const conf = s.confA === "east" ? "eastern" : s.confA === "west" ? "western" : null;
      if (!conf) continue;
      byConf[conf].push(
        serializeSeries(s, { ...ctx, round: "play_in", conference: conf })
      );
    }
    playInBlock = byConf;
  }

  return {
    season,
    isProjected: false,
    playIn: playInBlock,
    bracket: {
      eastern: easternBlock,
      western: westernBlock,
      finals,
    },
  };
}

export async function getNbaPlayoffs(season) {
  const currentSeason = await getCurrentSeason("nba");
  const resolvedSeason = season || currentSeason;
  if (!resolvedSeason) {
    return {
      season: null,
      isProjected: true,
      playIn: null,
      bracket: {
        eastern: emptyConfBlock("eastern"),
        western: emptyConfBlock("western"),
        finals: [emptySeries({ round: "finals", conference: null, teamA: null, teamB: null })],
      },
    };
  }
  const isCurrent = resolvedSeason === currentSeason;

  // 30s for current season (refreshes frequently), 30d for historical
  return cached(
    `playoffs:nba:${resolvedSeason}`,
    isCurrent ? 30 : 30 * 86400,
    async () => derivePlayoffs(resolvedSeason)
  );
}
