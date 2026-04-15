import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { getStandings, getRegularSeasonGames } from "./standingsService.js";
import { buildH2HMatrix, sortWithTiebreakers } from "../../utils/tiebreaker.js";
import {
  buildSeries,
  serializeSeries,
  emptySeries,
  emptyConfBlock,
  padConfBlock,
  clearDownstream,
  projectedTeamInfo,
} from "./_playoffsCommon.js";
import logger from "../../logger.js";

async function fetchNhlPlayoffGames(season) {
  const { rows } = await pool.query(
    `SELECT id, date, hometeamid, awayteamid, homescore, awayscore,
            winnerid, status, type
       FROM games
      WHERE league = 'nhl'
        AND season = $1
        AND type IN ('playoff', 'final')
      ORDER BY date ASC, id ASC`,
    [season]
  );
  return rows;
}

// Extracts the opening calendar year from a season string like "2022-23" → 2022.
function nhlSeasonYear(season) {
  return parseInt(String(season).split("-")[0], 10);
}

// Sort a group of teams using the NHL tiebreaker cascade.
function nhlSort(teams, matrix) {
  return sortWithTiebreakers([...teams], matrix, "nhl");
}

// Build canonical R1 bracket structure for one conference (east|west).
// Returns { projectedR1, seedMap, r1TeamToSlot, confKey } or null if data
// is insufficient (fewer than 6 teams per division or missing WCs).
function buildConfCanonical(conf, teamsById, matrix) {
  const confKey = conf === "east" ? "eastern" : "western";

  const confTeams = Array.from(teamsById.values()).filter(
    (t) => t.conf === conf && t.division
  );
  if (confTeams.length === 0) return null;

  // Group by division (two divisions per conference in post-2013 NHL)
  const byDiv = new Map();
  for (const t of confTeams) {
    const div = t.division.toLowerCase();
    if (!byDiv.has(div)) byDiv.set(div, []);
    byDiv.get(div).push(t);
  }
  if (byDiv.size !== 2) return null;

  const [divName0, divName1] = [...byDiv.keys()];
  const sorted0 = nhlSort(byDiv.get(divName0), matrix);
  const sorted1 = nhlSort(byDiv.get(divName1), matrix);

  const top0 = sorted0.slice(0, 3);
  const top1 = sorted1.slice(0, 3);
  if (top0.length < 3 || top1.length < 3) return null;

  // Wild cards: best 2 remaining in this conference
  const remaining = [...sorted0.slice(3), ...sorted1.slice(3)];
  const wcs = nhlSort(remaining, matrix);
  const wc1 = wcs[0] ?? null; // better wild card (WC1)
  const wc2 = wcs[1] ?? null; // worse wild card (WC2)

  // Determine "better" division (A): compare the two division leaders
  const ranked = nhlSort([top0[0], top1[0]], matrix);
  let divATop, divBTop;
  if (ranked[0].id === top0[0].id) {
    divATop = top0;
    divBTop = top1;
  } else {
    divATop = top1;
    divBTop = top0;
  }

  const [A1, A2, A3] = divATop;
  const [B1, B2, B3] = divBTop;

  // Playoff seeds: A1=1, B1=2, A2=3, A3=4, B2=5, B3=6, WC1=7, WC2=8
  const seedMap = new Map([
    [A1.id, 1], [B1.id, 2],
    [A2.id, 3], [A3.id, 4],
    [B2.id, 5], [B3.id, 6],
  ]);
  if (wc1) seedMap.set(wc1.id, 7);
  if (wc2) seedMap.set(wc2.id, 8);

  // Canonical R1 slot order:
  //   slot 0: A1 vs WC2  (top half)
  //   slot 1: A2 vs A3   (top half)
  //   slot 2: B2 vs B3   (bottom half)
  //   slot 3: B1 vs WC1  (bottom half)
  const projectedR1 = [
    emptySeries({ round: "r1", conference: confKey, teamA: projectedTeamInfo(A1, 1), teamB: wc2 ? projectedTeamInfo(wc2, 8) : null }),
    emptySeries({ round: "r1", conference: confKey, teamA: projectedTeamInfo(A2, 3), teamB: projectedTeamInfo(A3, 4) }),
    emptySeries({ round: "r1", conference: confKey, teamA: projectedTeamInfo(B2, 5), teamB: projectedTeamInfo(B3, 6) }),
    emptySeries({ round: "r1", conference: confKey, teamA: projectedTeamInfo(B1, 2), teamB: wc1 ? projectedTeamInfo(wc1, 7) : null }),
  ];

  // Map every projected R1 participant to their slot index (for actual-game matching)
  const r1TeamToSlot = new Map();
  for (let i = 0; i < projectedR1.length; i++) {
    const s = projectedR1[i];
    if (s.teamA?.id != null) r1TeamToSlot.set(s.teamA.id, i);
    if (s.teamB?.id != null) r1TeamToSlot.set(s.teamB.id, i);
  }

  return { projectedR1, seedMap, r1TeamToSlot, confKey };
}

// Match actual R1 series to the 4 canonical slots.
// Returns array[4]: each element is the matching actual series or null.
//
// When both teams of a series map to different projected slots (cross-slot
// series — possible when historical standings data differs from the actual
// playoff seeding), we assign to the slot of the better-seeded team so the
// higher seed's series stays in its expected bracket position.
function matchR1ToSlots(actualR1, r1TeamToSlot, seedMap) {
  const matched = new Array(4).fill(null);
  const usedSlots = new Set();

  for (const series of actualR1) {
    const slotA = r1TeamToSlot.get(series.teamAId) ?? null;
    const slotB = r1TeamToSlot.get(series.teamBId) ?? null;

    let slot;
    if (slotA === null && slotB === null) continue;
    else if (slotA === null) slot = slotB;
    else if (slotB === null) slot = slotA;
    else if (slotA === slotB) slot = slotA;
    else {
      // Cross-slot: pick the slot belonging to the better-seeded (lower seed
      // number) team so the projected bracket position is preserved.
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

// Order the two semi-finals so that the top-half matchup (slots 0+1) is first.
function orderSemis(semisList, r1Matched, r1TeamToSlot) {
  if (semisList.length !== 2) return semisList;

  // Build extended participant→slot map including actual R1 teams
  const toSlot = new Map(r1TeamToSlot);
  for (let i = 0; i < r1Matched.length; i++) {
    const s = r1Matched[i];
    if (!s) continue;
    toSlot.set(s.teamAId, i);
    toSlot.set(s.teamBId, i);
  }

  const isTopHalf = (s) => {
    const sa = toSlot.get(s.teamAId ?? s.teamA?.id);
    const sb = toSlot.get(s.teamBId ?? s.teamB?.id);
    return sa === 0 || sa === 1 || sb === 0 || sb === 1;
  };

  if (isTopHalf(semisList[1]) && !isTopHalf(semisList[0])) {
    return [semisList[1], semisList[0]];
  }
  return semisList;
}

async function deriveNhlPlayoffs(season) {
  const [games, rawStandings, h2hGames] = await Promise.all([
    fetchNhlPlayoffGames(season),
    getStandings("nhl", season),
    getRegularSeasonGames("nhl", season),
  ]);

  const teamsById = new Map();
  for (const r of rawStandings) {
    teamsById.set(r.id, {
      ...r,
      wins: Number(r.wins) || 0,
      losses: Number(r.losses) || 0,
      otl: Number(r.otl) || 0,
      regWins: Number(r.regWins) || 0,
      gf: Number(r.gf) || 0,
    });
  }

  // Guard: all teams with a conf should also have a division
  const missingDiv = Array.from(teamsById.values()).filter(
    (t) => t.conf && !t.division
  );
  if (missingDiv.length > 0) {
    logger.warn(
      { count: missingDiv.length },
      "NHL teams missing division — returning empty projected bracket"
    );
    return {
      season,
      isProjected: true,
      warning: "division_data_missing",
      playIn: null,
      bracket: {
        eastern: emptyConfBlock("eastern"),
        western: emptyConfBlock("western"),
        finals: [emptySeries({ round: "finals", conference: null, teamA: null, teamB: null })],
      },
    };
  }

  const confByTeamId = new Map();
  for (const [id, t] of teamsById) confByTeamId.set(id, (t.conf || "").toLowerCase());
  // Only need the matrix here; regWins/gf/pointDiff already on team objects from getStandings
  const { matrix } = buildH2HMatrix(h2hGames, confByTeamId, "nhl");

  const eastCanon = buildConfCanonical("east", teamsById, matrix);
  const westCanon = buildConfCanonical("west", teamsById, matrix);

  if (!eastCanon || !westCanon) {
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

  const seedMapById = new Map([...eastCanon.seedMap, ...westCanon.seedMap]);
  const ctx = { teamsById, seedMap: seedMapById };

  // Projected mode: no playoff games yet
  if (games.length === 0) {
    return {
      season,
      isProjected: true,
      playIn: null,
      bracket: {
        eastern: {
          r1: eastCanon.projectedR1,
          semis: emptyConfBlock("eastern").semis,
          confFinals: emptyConfBlock("eastern").confFinals,
        },
        western: {
          r1: westCanon.projectedR1,
          semis: emptyConfBlock("western").semis,
          confFinals: emptyConfBlock("western").confFinals,
        },
        finals: [emptySeries({ round: "finals", conference: null, teamA: null, teamB: null })],
      },
    };
  }

  const allSeries = buildSeries(games, teamsById);

  const finalsSeries = allSeries.filter((s) => s.hasFinalTypeGame);
  const nonFinals = allSeries.filter((s) => !s.hasFinalTypeGame);

  const eastSeries = [];
  const westSeries = [];
  for (const s of nonFinals) {
    if (s.isInterConference) {
      logger.warn(
        { teamA: s.teamAId, teamB: s.teamBId, season },
        "Skipping cross-conference non-final NHL playoff series"
      );
      continue;
    }
    if (!s.confA || !s.confB) {
      logger.warn(
        { teamA: s.teamAId, teamB: s.teamBId, season },
        "NHL playoff series team missing conference data"
      );
      continue;
    }
    if (s.confA === "east") eastSeries.push(s);
    else if (s.confA === "west") westSeries.push(s);
  }

  const buildConfBlock = (confSeriesList, canon) => {
    const { projectedR1, r1TeamToSlot, seedMap: confSeedMap, confKey } = canon;

    // Date-based round classification: first 4 = R1, next 2 = semis, next 1 = CF
    const sorted = [...confSeriesList].sort(
      (a, b) => new Date(a.firstGameDate).getTime() - new Date(b.firstGameDate).getTime()
    );
    const actualR1 = sorted.slice(0, 4);
    const actualSemis = sorted.slice(4, 6);
    const actualCF = sorted.slice(6, 7);

    // Match actual R1 to canonical slots for consistent bracket ordering
    const r1Matched = matchR1ToSlots(actualR1, r1TeamToSlot, confSeedMap);

    const r1 = r1Matched.map((actual, i) => {
      if (actual) {
        return serializeSeries(actual, { ...ctx, round: "r1", conference: confKey });
      }
      return projectedR1[i];
    });

    const serializedSemis = actualSemis.map((s) =>
      serializeSeries(s, { ...ctx, round: "semis", conference: confKey })
    );
    const semis = orderSemis(serializedSemis, r1Matched, r1TeamToSlot);

    const confFinals = actualCF.map((s) =>
      serializeSeries(s, { ...ctx, round: "confFinals", conference: confKey })
    );

    const block = { r1, semis, confFinals };
    padConfBlock(block, confKey);
    clearDownstream(block, confKey);
    return block;
  };

  const easternBlock = buildConfBlock(eastSeries, eastCanon);
  const westernBlock = buildConfBlock(westSeries, westCanon);

  const finals =
    finalsSeries.length > 0
      ? finalsSeries.map((s) =>
          serializeSeries(s, { ...ctx, round: "finals", conference: null })
        )
      : [emptySeries({ round: "finals", conference: null, teamA: null, teamB: null })];

  return {
    season,
    isProjected: false,
    playIn: null,
    bracket: {
      eastern: easternBlock,
      western: westernBlock,
      finals,
    },
  };
}

export async function getNhlPlayoffs(season) {
  const currentSeason = await getCurrentSeason("nhl");
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

  // 2013-14 onward (current wild-card format); 2019-20 bubble used non-standard seeding
  const year = nhlSeasonYear(resolvedSeason);
  if (year < 2013 || resolvedSeason === "2019-20") {
    return { season: resolvedSeason, unsupported: true };
  }

  const isCurrent = resolvedSeason === currentSeason;

  return cached(
    `playoffs:nhl:${resolvedSeason}`,
    isCurrent ? 30 : 30 * 86400,
    async () => deriveNhlPlayoffs(resolvedSeason)
  );
}
