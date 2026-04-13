import pool from "../db/db.js";
import { cached } from "../cache/cache.js";
import { getCurrentSeason } from "../cache/seasons.js";
import { getStandings, getRegularSeasonGames } from "./standingsService.js";
import { buildH2HMatrix, sortWithTiebreakers } from "../utils/tiebreaker.js";
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
        AND (type IN ('playoff', 'final') OR game_label ILIKE '%play-in%')
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

function computeStandingsSeeds(teamsById, h2hMatrix) {
  const seedByTeamId = new Map();
  for (const conf of ["east", "west"]) {
    const teams = Array.from(teamsById.values())
      .filter((t) => t.conf === conf);
    const sorted = sortWithTiebreakers(teams, h2hMatrix, "nba");
    sorted.forEach((t, i) => seedByTeamId.set(t.id, i + 1));
  }
  return seedByTeamId;
}

// Play-in games: both teams are seeds 7–10 in the same conference.
// The old heuristic (games.length === 1) broke when R1 series had only
// one game played — those got misclassified as play-in.
function classifyPlayIn(allSeries, seedByTeamId) {
  const playInSeries = [];
  const remainingSeries = [];

  for (const s of allSeries) {
    const seedA = seedByTeamId.get(s.teamAId);
    const seedB = seedByTeamId.get(s.teamBId);
    if (
      seedA != null && seedB != null &&
      seedA >= 7 && seedA <= 10 &&
      seedB >= 7 && seedB <= 10 &&
      !s.isInterConference
    ) {
      playInSeries.push(s);
    } else {
      remainingSeries.push(s);
    }
  }

  return { playInSeries, remainingSeries };
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

// Top-half of the bracket: seeds from 1v8 and 4v5 R1 matchups.
// A semi whose participants came from these matchups belongs in slot 0 (top).
const TOP_HALF_SEEDS = new Set(R1_SEED_PAIRS.slice(0, 2).flat());

function orderSemisByBracketHalf(semisList) {
  if (semisList.length !== 2) return semisList;
  const isTopHalf = (s) => {
    const sa = s.teamA?.seed;
    const sb = s.teamB?.seed;
    return (sa && TOP_HALF_SEEDS.has(sa)) || (sb && TOP_HALF_SEEDS.has(sb));
  };
  if (isTopHalf(semisList[1]) && !isTopHalf(semisList[0])) {
    return [semisList[1], semisList[0]];
  }
  return semisList;
}

// Rank R1 participants by regular-season wins to infer seeds.
// Validates that inferred seeds produce canonical {1:8, 4:5, 3:6, 2:7} matchups.
function inferSeedsFromR1(r1Series, standingsByConf, h2hMatrix) {
  if (r1Series.length !== 4) return null;

  const participants = new Set();
  for (const s of r1Series) {
    participants.add(s.teamAId);
    participants.add(s.teamBId);
  }
  if (participants.size !== 8) return null;

  const ranked = sortWithTiebreakers(
    Array.from(participants).map((id) => standingsByConf.get(id)).filter(Boolean),
    h2hMatrix,
    "nba"
  );

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

function emptySeries({ round, conference, teamA, teamB, playInTier = null }) {
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

function buildProjectedConference(conf, teamsById, h2hMatrix) {
  const confKey = conf === "east" ? "eastern" : "western";

  const teams = sortWithTiebreakers(
    Array.from(teamsById.values()).filter((t) => t.conf === conf),
    h2hMatrix,
    "nba"
  );

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
        playInTier: 1,
      }),
      emptySeries({
        round: "play_in",
        conference: confKey,
        teamA: projectedTeamInfo(playIn910[0], 9),
        teamB: projectedTeamInfo(playIn910[1], 10),
        playInTier: 1,
      }),
      emptySeries({
        round: "play_in",
        conference: confKey,
        teamA: null,
        teamB: null,
        playInTier: 2,
      })
    );
  }

  return { r1, semis, confFinals, playIn };
}

// Merge actual R1 series with projected fallbacks in canonical order.
// Handles partial R1 (e.g. play-in phase when 1v?/2v? are still TBD).
function mergeR1WithCanonicalOrder(actualR1, projectedR1, confKey) {
  const seedToSlot = new Map();
  for (const [a, b] of R1_SEED_PAIRS) {
    const key = `${a}-${b}`;
    seedToSlot.set(a, key);
    seedToSlot.set(b, key);
  }

  const index = (list, inferFromSingle) => {
    const map = new Map();
    for (const s of list) {
      const sa = s.teamA?.seed;
      const sb = s.teamB?.seed;
      if (sa && sb) {
        const key = sa < sb ? `${sa}-${sb}` : `${sb}-${sa}`;
        map.set(key, s);
      } else if (inferFromSingle && (sa || sb)) {
        const key = seedToSlot.get(sa || sb);
        if (key && !map.has(key)) map.set(key, s);
      }
    }
    return map;
  };

  const actual = index(actualR1, true);
  const projected = index(projectedR1, false);

  return R1_SEED_PAIRS.map(([a, b]) => {
    const key = `${a}-${b}`;
    return actual.get(key) ?? projected.get(key) ??
      emptySeries({ round: "r1", conference: confKey, teamA: null, teamB: null });
  });
}

async function derivePlayoffs(season) {
  const [games, rawStandings, h2hGames] = await Promise.all([
    fetchPlayoffGames(season),
    getStandings("nba", season),
    getRegularSeasonGames("nba", season),
  ]);
  const teamsById = new Map();
  for (const r of rawStandings) {
    teamsById.set(r.id, {
      ...r,
      wins: Number(r.wins) || 0,
      losses: Number(r.losses) || 0,
    });
  }

  const confByTeamId = new Map();
  for (const [id, t] of teamsById) confByTeamId.set(id, (t.conf || "").toLowerCase());
  const h2hData = buildH2HMatrix(h2hGames, confByTeamId);

  if (games.length === 0) {
    const east = buildProjectedConference("east", teamsById, h2hData.matrix);
    const west = buildProjectedConference("west", teamsById, h2hData.matrix);
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

  const standingsSeedMap = computeStandingsSeeds(teamsById, h2hData.matrix);

  const { playInSeries, remainingSeries } = classifyPlayIn(nonFinalsSeries, standingsSeedMap);

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
  const eastSeedMap = inferSeedsFromR1(eastRounds.r1, standingsByConfEast, h2hData.matrix);
  const westSeedMap = inferSeedsFromR1(westRounds.r1, standingsByConfWest, h2hData.matrix);

  if (!eastSeedMap) {
    logger.debug({ season }, "East seed inference failed, using standings fallback");
  }
  if (!westSeedMap) {
    logger.debug({ season }, "West seed inference failed, using standings fallback");
  }

  // Start with standings-based seeds, overlay R1-inferred seeds where available
  const seedMapById = new Map(standingsSeedMap);
  if (eastSeedMap) for (const [id, seed] of eastSeedMap) seedMapById.set(id, seed);
  if (westSeedMap) for (const [id, seed] of westSeedMap) seedMapById.set(id, seed);
  const ctx = { teamsById, seedMap: seedMapById };

  const serializeConf = (rounds, confKey) => ({
    r1: rounds.r1.map((s) => serializeSeries(s, { ...ctx, round: "r1", conference: confKey })),
    semis: orderSemisByBracketHalf(
      rounds.semis.map((s) => serializeSeries(s, { ...ctx, round: "semis", conference: confKey }))
    ),
    confFinals: rounds.confFinals.map((s) =>
      serializeSeries(s, { ...ctx, round: "confFinals", conference: confKey })
    ),
  });

  const easternBlock = serializeConf(eastRounds, "eastern");
  const westernBlock = serializeConf(westRounds, "western");

  // Merge actual R1 with projected matchups in canonical seed order.
  // Handles partial R1 (e.g. play-in phase when 1v?/2v? slots are TBD).
  const projEast = buildProjectedConference("east", teamsById, h2hData.matrix);
  const projWest = buildProjectedConference("west", teamsById, h2hData.matrix);
  easternBlock.r1 = mergeR1WithCanonicalOrder(easternBlock.r1, projEast?.r1 ?? [], "eastern");
  westernBlock.r1 = mergeR1WithCanonicalOrder(westernBlock.r1, projWest?.r1 ?? [], "western");

  padConfBlock(easternBlock, "eastern");
  padConfBlock(westernBlock, "western");

  const finals =
    finalsSeries.length > 0
      ? finalsSeries.map((s) =>
          serializeSeries(s, { ...ctx, round: "finals", conference: null })
        )
      : [emptySeries({ round: "finals", conference: null, teamA: null, teamB: null })];

  // Show play-in when:
  // 1. Actual play-in games exist and are incomplete or R1 hasn't started, OR
  // 2. Any R1 series has a TBD opponent (placeholder team → null), meaning
  //    play-in hasn't resolved — show projected play-in from standings.
  const r1Started = eastRounds.r1.length > 0 || westRounds.r1.length > 0;
  const hasUnresolvedR1 = [...easternBlock.r1, ...westernBlock.r1].some(
    (s) => !s.teamA || !s.teamB
  );

  let playInBlock = null;
  if (playInSeries.length > 0) {
    const anyIncomplete = playInSeries.some(
      (s) => !s.games.every((g) => isFinalStatus(g.status))
    );
    if (anyIncomplete || !r1Started) {
      const byConf = { eastern: [], western: [] };
      for (const s of playInSeries) {
        const conf = s.confA === "east" ? "eastern" : s.confA === "west" ? "western" : null;
        if (!conf) continue;
        const serialized = serializeSeries(s, { ...ctx, round: "play_in", conference: conf });
        const sA = standingsSeedMap.get(s.teamAId);
        const sB = standingsSeedMap.get(s.teamBId);
        const bothHigh = sA >= 7 && sA <= 8 && sB >= 7 && sB <= 8;
        const bothLow = sA >= 9 && sA <= 10 && sB >= 9 && sB <= 10;
        serialized.playInTier = (bothHigh || bothLow) ? 1 : 2;
        byConf[conf].push(serialized);
      }
      playInBlock = byConf;
    }
  }
  if (!playInBlock && (!r1Started || hasUnresolvedR1)) {
    // No actual play-in games — build projected play-in from standings
    const pe = projEast || buildProjectedConference("east", teamsById, h2hData.matrix);
    const pw = projWest || buildProjectedConference("west", teamsById, h2hData.matrix);
    const block = {
      eastern: pe?.playIn ?? [],
      western: pw?.playIn ?? [],
    };
    if (block.eastern.length > 0 || block.western.length > 0) {
      playInBlock = block;
    }
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
