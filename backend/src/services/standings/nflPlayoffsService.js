import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { getStandings, getRegularSeasonGames } from "./standingsService.js";
import { buildH2HMatrix, sortWithTiebreakers } from "../../utils/tiebreaker.js";
import {
  buildSeries,
  serializeSeries,
  emptySeries,
  projectedTeamInfo,
} from "./_playoffsCommon.js";
import logger from "../../logger.js";

async function fetchNflPlayoffGames(season) {
  const { rows } = await pool.query(
    `SELECT id, date, hometeamid, awayteamid, homescore, awayscore,
            winnerid, status, type, game_label
       FROM games
      WHERE league = 'nfl'
        AND season = $1
        AND type IN ('playoff', 'final')
      ORDER BY date ASC, id ASC`,
    [season]
  );
  return rows;
}

// Extracts the opening calendar year from a season string like "2023-24" → 2023.
function nflSeasonYear(season) {
  return parseInt(String(season).split("-")[0], 10);
}

// 14-team format (2020+): 7 seeds per conf, 1-seed bye, 3 Wild Card games.
// 12-team format (pre-2020): 6 seeds per conf, 2-seed byes (seeds 1+2), 2 Wild Card games.
function bracketFormat(season) {
  return nflSeasonYear(season) >= 2020 ? "14team" : "12team";
}

function nflSort(teams, matrix) {
  return sortWithTiebreakers([...teams], matrix, "nfl");
}

// Classify a series' round from its first game's game_label.
function classifyRound(gameLabel, hasFinalTypeGame) {
  if (hasFinalTypeGame) return "superBowl";
  const s = (gameLabel || "").toLowerCase();
  if (s.includes("wild card") || s.includes("wild-card")) return "wildCard";
  if (s.includes("divisional")) return "divisional";
  if (s.includes("championship")) return "confChampionship";
  return null;
}

// Helper to build a projected empty series with seeded teams.
function makeProjSeries(teamA, teamB, conf, round, seedMap) {
  const sA = seedMap.get(teamA?.id);
  const sB = seedMap.get(teamB?.id);
  return emptySeries({
    round,
    conference: conf,
    teamA: teamA ? projectedTeamInfo(teamA, sA) : null,
    teamB: teamB ? projectedTeamInfo(teamB, sB) : null,
  });
}

// Build canonical bracket structure for one conference.
// Returns null if insufficient team data (missing divisions).
function buildConfCanonical(conf, teamsById, matrix, format) {
  const confTeams = Array.from(teamsById.values()).filter(
    (t) => (t.conf || "").toLowerCase() === conf && t.division
  );
  if (confTeams.length === 0) return null;

  // Group by division — NFL must have 4 divisions per conference.
  const byDiv = new Map();
  for (const t of confTeams) {
    const div = t.division.toLowerCase();
    if (!byDiv.has(div)) byDiv.set(div, []);
    byDiv.get(div).push(t);
  }
  if (byDiv.size !== 4) return null;

  // Division winners: top of each division sorted by NFL tiebreakers.
  const divWinners = [];
  const nonWinners = [];
  for (const divTeams of byDiv.values()) {
    const sorted = nflSort(divTeams, matrix);
    divWinners.push(sorted[0]);
    nonWinners.push(...sorted.slice(1));
  }

  // Seeds 1–4: division winners ranked against each other.
  const rankedWinners = nflSort(divWinners, matrix);

  // Seeds 5–7 (14-team) or 5–6 (12-team): best non-division-winners.
  const wcCount = format === "14team" ? 3 : 2;
  const wildCards = nflSort(nonWinners, matrix).slice(0, wcCount);

  const seedMap = new Map();
  rankedWinners.forEach((t, i) => seedMap.set(t.id, i + 1));
  wildCards.forEach((t, i) => seedMap.set(t.id, 5 + i));

  // Canonical Wild Card matchups (higher seed listed first after serialization).
  // 14-team: 2v7, 3v6, 4v5 — 1-seed has bye.
  // 12-team: 3v6, 4v5 — 1-seed and 2-seed have byes.
  const wildCardProjected =
    format === "14team"
      ? [
          makeProjSeries(rankedWinners[1], wildCards[2], conf, "wildCard", seedMap),
          makeProjSeries(rankedWinners[2], wildCards[1], conf, "wildCard", seedMap),
          makeProjSeries(rankedWinners[3], wildCards[0], conf, "wildCard", seedMap),
        ]
      : [
          makeProjSeries(rankedWinners[2], wildCards[1], conf, "wildCard", seedMap),
          makeProjSeries(rankedWinners[3], wildCards[0], conf, "wildCard", seedMap),
        ];

  return { conf, format, seedMap, rankedWinners, wildCards, wildCardProjected };
}

// Match a list of actual series to canonical projected slots (by team-pair lookup).
// Returns an array of the same length as projectedSlots: each element is the
// actual series for that slot or null if no match found.
function matchActualToSlots(actualSeries, projectedSlots, seedMap) {
  const matched = new Array(projectedSlots.length).fill(null);
  const usedSlots = new Set();

  const teamToSlot = new Map();
  for (let i = 0; i < projectedSlots.length; i++) {
    const s = projectedSlots[i];
    if (s.teamA?.id != null) teamToSlot.set(s.teamA.id, i);
    if (s.teamB?.id != null) teamToSlot.set(s.teamB.id, i);
  }

  for (const series of actualSeries) {
    const slotA = teamToSlot.get(series.teamAId) ?? null;
    const slotB = teamToSlot.get(series.teamBId) ?? null;

    let slot;
    if (slotA === null && slotB === null) continue;
    else if (slotA === null) slot = slotB;
    else if (slotB === null) slot = slotA;
    else if (slotA === slotB) slot = slotA;
    else {
      // Cross-slot: assign to the slot of the better-seeded (lower number) team.
      const seedA = seedMap?.get(series.teamAId) ?? 99;
      const seedB = seedMap?.get(series.teamBId) ?? 99;
      slot = seedA <= seedB ? slotA : slotB;
    }

    if (slot != null && !usedSlots.has(slot)) {
      matched[slot] = series;
      usedSlots.add(slot);
    }
  }

  return matched;
}

// Returns { team, seed } for the winner (actual or projected) of a single-game series.
// seedMap is optional — consulted when team.seed isn't already embedded (e.g. standings-projected
// teams that haven't gone through serializeSeries).
function survivorOfSeries(series, seedMap) {
  const { winnerId, teamA, teamB } = series;
  if (winnerId != null) {
    const team = teamA?.id === winnerId ? teamA : teamB;
    if (!team) return null;
    return { team, seed: seedMap?.get(team.id) ?? team.seed ?? 99 };
  }
  if (teamA && teamB) {
    const sA = teamA.seed ?? seedMap?.get(teamA.id) ?? 99;
    const sB = teamB.seed ?? seedMap?.get(teamB.id) ?? 99;
    return sA <= sB ? { team: teamA, seed: sA } : { team: teamB, seed: sB };
  }
  if (teamA) return { team: teamA, seed: teamA.seed ?? 99 };
  if (teamB) return { team: teamB, seed: teamB.seed ?? 99 };
  return null;
}

// After Wild Card, NFL reseeds: remaining teams pair highest vs lowest seed.
function projectDivisional(wildCardResult, rankedWinners, wildCards, canon) {
  const { conf, format, seedMap } = canon;

  const survivors = [];

  // Bye teams: 14-team → seed 1 only; 12-team → seeds 1 and 2.
  const byeCount = format === "14team" ? 1 : 2;
  for (let i = 0; i < byeCount; i++) {
    survivors.push({ team: rankedWinners[i], seed: i + 1 });
  }

  for (const s of wildCardResult) {
    const survivor = survivorOfSeries(s, seedMap);
    if (survivor) survivors.push(survivor);
  }

  // Sort by seed (best first) then pair highest vs lowest (NFL reseeding).
  survivors.sort((a, b) => a.seed - b.seed);

  const divProjected = [];
  const n = survivors.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const top = survivors[i];
    const bot = survivors[n - 1 - i];
    divProjected.push(
      emptySeries({
        round: "divisional",
        conference: conf,
        teamA: top.team ? projectedTeamInfo(top.team, top.seed) : null,
        teamB: bot.team ? projectedTeamInfo(bot.team, bot.seed) : null,
      })
    );
  }
  while (divProjected.length < 2) {
    divProjected.push(emptySeries({ round: "divisional", conference: conf, teamA: null, teamB: null }));
  }

  return divProjected;
}

// Project the Conference Championship matchup from Divisional survivors.
function projectChampionship(divisionalResult, canon) {
  const { conf } = canon;

  const survivors = divisionalResult
    .map((s) => survivorOfSeries(s, null))
    .filter(Boolean)
    .map((x) => x.team);

  return emptySeries({
    round: "confChampionship",
    conference: conf,
    teamA: survivors[0] ?? null,
    teamB: survivors[1] ?? null,
  });
}

// Clear later rounds when their predecessors haven't produced any results yet.
function clearNflDownstream(block, conf) {
  // Only clear Championship if no Divisional game has been completed.
  const anyDivComplete = block.divisional.some((s) => s.isComplete);
  if (!anyDivComplete) {
    const anyCfPlayed = block.confChampionship.some(
      (s) => s.games?.length > 0 && s.games?.some((g) => g.winnerid != null)
    );
    if (!anyCfPlayed) {
      block.confChampionship = [
        emptySeries({ round: "confChampionship", conference: conf, teamA: null, teamB: null }),
      ];
    }
  }
}

function emptyNflBracket(format) {
  const wcLen = format === "14team" ? 3 : 2;
  const makeConf = (conf) => ({
    wildCard: Array.from({ length: wcLen }, () =>
      emptySeries({ round: "wildCard", conference: conf, teamA: null, teamB: null })
    ),
    divisional: Array.from({ length: 2 }, () =>
      emptySeries({ round: "divisional", conference: conf, teamA: null, teamB: null })
    ),
    confChampionship: [
      emptySeries({ round: "confChampionship", conference: conf, teamA: null, teamB: null }),
    ],
  });
  return {
    afc: makeConf("afc"),
    nfc: makeConf("nfc"),
    superBowl: [emptySeries({ round: "superBowl", conference: null, teamA: null, teamB: null })],
  };
}

function projectedConfBlock(canon) {
  const { conf, wildCardProjected } = canon;
  return {
    wildCard: wildCardProjected,
    divisional: Array.from({ length: 2 }, () =>
      emptySeries({ round: "divisional", conference: conf, teamA: null, teamB: null })
    ),
    confChampionship: [
      emptySeries({ round: "confChampionship", conference: conf, teamA: null, teamB: null }),
    ],
  };
}

async function deriveNflPlayoffs(season) {
  const format = bracketFormat(season);

  const [games, rawStandings, h2hGames] = await Promise.all([
    fetchNflPlayoffGames(season),
    getStandings("nfl", season),
    getRegularSeasonGames("nfl", season),
  ]);

  const teamsById = new Map();
  for (const r of rawStandings) {
    teamsById.set(r.id, {
      ...r,
      wins: Number(r.wins) || 0,
      losses: Number(r.losses) || 0,
      ties: Number(r.ties) || 0,
    });
  }

  // Guard: all conf-assigned teams should also have a division.
  const missingDiv = Array.from(teamsById.values()).filter(
    (t) => t.conf && !t.division
  );
  if (missingDiv.length > 0) {
    logger.warn(
      { count: missingDiv.length },
      "NFL teams missing division — returning empty projected bracket"
    );
    return {
      season,
      isProjected: true,
      format,
      warning: "division_data_missing",
      bracket: emptyNflBracket(format),
    };
  }

  const confByTeamId = new Map();
  const divByTeamId = new Map();
  for (const [id, t] of teamsById) {
    confByTeamId.set(id, (t.conf || "").toLowerCase());
    divByTeamId.set(id, (t.division || "").toLowerCase());
  }

  const { matrix } = buildH2HMatrix(h2hGames, confByTeamId, "nfl", divByTeamId);

  const afcCanon = buildConfCanonical("afc", teamsById, matrix, format);
  const nfcCanon = buildConfCanonical("nfc", teamsById, matrix, format);

  if (!afcCanon || !nfcCanon) {
    return {
      season,
      isProjected: true,
      format,
      bracket: emptyNflBracket(format),
    };
  }

  const seedMapById = new Map([...afcCanon.seedMap, ...nfcCanon.seedMap]);
  const ctx = { teamsById, seedMap: seedMapById };

  // Projected mode: no playoff games yet.
  if (games.length === 0) {
    return {
      season,
      isProjected: true,
      format,
      bracket: {
        afc: projectedConfBlock(afcCanon),
        nfc: projectedConfBlock(nfcCanon),
        superBowl: [emptySeries({ round: "superBowl", conference: null, teamA: null, teamB: null })],
      },
    };
  }

  // Build series from actual games (single-elimination: bestOf = 1).
  const allSeries = buildSeries(games, teamsById, { bestOf: 1 });

  // Partition by conference and round.
  const superBowlSeries = [];
  const byConfRound = { afc: {}, nfc: {} };

  for (const s of allSeries) {
    const round = classifyRound(s.games[0]?.game_label, s.hasFinalTypeGame);
    if (!round) continue;
    if (round === "superBowl") {
      superBowlSeries.push(s);
      continue;
    }
    // Intra-conference only (cross-conf non-final gets skipped).
    if (!s.confA || s.isInterConference) {
      logger.warn(
        { teamA: s.teamAId, teamB: s.teamBId, season },
        "Skipping cross-conference non-Super Bowl NFL playoff series"
      );
      continue;
    }
    const conf = s.confA.toLowerCase();
    if (conf !== "afc" && conf !== "nfc") continue;
    if (!byConfRound[conf][round]) byConfRound[conf][round] = [];
    byConfRound[conf][round].push(s);
  }

  const buildConfBlock = (roundSeries, canon) => {
    const { conf, seedMap: confSeedMap, wildCardProjected, rankedWinners, wildCards } =
      canon;

    const wcActual = roundSeries.wildCard || [];
    const wcMatched = matchActualToSlots(wcActual, wildCardProjected, confSeedMap);
    const wildCard = wcMatched.map((actual, i) => {
      if (actual)
        return serializeSeries(actual, { ...ctx, round: "wildCard", conference: conf });
      return wildCardProjected[i];
    });

    const divProjected = projectDivisional(wildCard, rankedWinners, wildCards, canon);
    const divActual = roundSeries.divisional || [];
    const divMatched = matchActualToSlots(divActual, divProjected, confSeedMap);
    const divisional = divMatched.map((actual, i) => {
      if (actual)
        return serializeSeries(actual, { ...ctx, round: "divisional", conference: conf });
      return divProjected[i];
    });

    const cfActual = roundSeries.confChampionship || [];
    const cfProjected = projectChampionship(divisional, canon);
    const confChampionship =
      cfActual.length > 0
        ? [serializeSeries(cfActual[0], { ...ctx, round: "confChampionship", conference: conf })]
        : [cfProjected];

    const block = { wildCard, divisional, confChampionship };
    clearNflDownstream(block, conf);
    return block;
  };

  const afcBlock = buildConfBlock(byConfRound.afc, afcCanon);
  const nfcBlock = buildConfBlock(byConfRound.nfc, nfcCanon);

  const superBowl =
    superBowlSeries.length > 0
      ? superBowlSeries.map((s) =>
          serializeSeries(s, { ...ctx, round: "superBowl", conference: null })
        )
      : [emptySeries({ round: "superBowl", conference: null, teamA: null, teamB: null })];

  return {
    season,
    isProjected: false,
    format,
    bracket: { afc: afcBlock, nfc: nfcBlock, superBowl },
  };
}

export async function getNflPlayoffs(season) {
  const currentSeason = await getCurrentSeason("nfl");
  const resolvedSeason = season || currentSeason;

  if (!resolvedSeason) {
    return {
      season: null,
      isProjected: true,
      format: "14team",
      bracket: emptyNflBracket("14team"),
    };
  }

  // Data is reliable from 2015 onward (14-team format since 2020-21 season).
  const year = nflSeasonYear(resolvedSeason);
  if (year < 2015) {
    return { season: resolvedSeason, unsupported: true };
  }

  const isCurrent = resolvedSeason === currentSeason;

  return cached(
    `playoffs:nfl:${resolvedSeason}`,
    isCurrent ? 30 : 30 * 86400,
    async () => deriveNflPlayoffs(resolvedSeason)
  );
}
