import { describe, it, expect } from "@jest/globals";
import { buildH2HMatrix, sortWithTiebreakers } from "../../src/utils/tiebreaker.js";

// Build a minimal team object used in sorting tests.
function team(id, opts = {}) {
  const wins   = opts.wins   ?? 40;
  const losses = opts.losses ?? 35;
  const otl    = opts.otl    ?? 0;
  const gp     = wins + losses;
  return {
    id,
    wins,
    losses,
    otl,
    regWins:   opts.regWins   ?? wins,
    gf:        opts.gf        ?? wins * 3,
    pointDiff: opts.pointDiff ?? wins - losses,
    confWinPct: opts.confWinPct ?? (gp > 0 ? wins / gp : 0),
  };
}

// Build a simple H2H matrix from an array of game records:
// each entry is { home, away, winner, ot? } where ot=true means the game
// went to overtime (ot1 IS NOT NULL in the real schema).
function matrixFrom(records, league = "nhl") {
  const games = records.map((r, i) => ({
    id: i + 1,
    hometeamid: r.home,
    awayteamid: r.away,
    homescore: r.winner === r.home ? 2 : 1,
    awayscore: r.winner === r.away ? 2 : 1,
    winnerid: r.winner,
    ot1: r.ot ? "0:00" : null,
  }));
  // Conf map: every team in the same conference for maximum H2H exposure
  const teamIds = new Set(records.flatMap((r) => [r.home, r.away]));
  const confByTeamId = new Map([...teamIds].map((id) => [id, "east"]));
  return buildH2HMatrix(games, confByTeamId, league);
}

describe("buildH2HMatrix — NHL OT tracking", () => {
  it("counts OT losses for the loser when ot1 IS NOT NULL", () => {
    const { matrix } = matrixFrom([
      { home: 1, away: 2, winner: 1, ot: true },  // 1 wins in OT, 2 OT-loss
      { home: 2, away: 1, winner: 1, ot: false }, // 1 wins in reg
    ]);

    const rec12 = matrix.get(1)?.get(2);
    const rec21 = matrix.get(2)?.get(1);

    expect(rec12.wins).toBe(2);
    expect(rec12.otLosses).toBe(0); // 1 never took an OT loss vs 2

    expect(rec21.wins).toBe(0);
    expect(rec21.otLosses).toBe(1); // 2 took 1 OT loss vs 1
  });

  it("counts regWins only for wins where ot1 IS NULL", () => {
    const { teamRegWins } = matrixFrom([
      { home: 1, away: 2, winner: 1, ot: true },  // NOT a reg win for team 1
      { home: 1, away: 2, winner: 1, ot: false }, // IS a reg win
      { home: 2, away: 1, winner: 2, ot: true },  // NOT a reg win for team 2
    ]);

    expect(teamRegWins.get(1)).toBe(1); // only the non-OT win
    expect(teamRegWins.get(2)).toBe(0); // their only win was in OT
  });

  it("does not track regWins or otLosses for non-NHL leagues", () => {
    const games = [
      { id: 1, hometeamid: 1, awayteamid: 2, homescore: 2, awayscore: 1, winnerid: 1, ot1: "0:00" },
    ];
    const confByTeamId = new Map([[1, "east"], [2, "east"]]);
    const { matrix, teamRegWins } = buildH2HMatrix(games, confByTeamId, "nba");

    const rec21 = matrix.get(2)?.get(1);
    expect(rec21.otLosses).toBe(0); // no NHL tracking for NBA
    expect(teamRegWins.get(1)).toBe(0); // regWins only incremented for NHL
  });
});

describe("sortWithTiebreakers — NHL ptsPct primary sort", () => {
  it("ranks teams by NHL points percentage (2pts/win + 1pt/OTL)", () => {
    // team A: 46W 28L 8OTL in 74 GP → pts = 100, pct = 100/148 ≈ 0.676
    // team B: 50W 24L 0OTL in 74 GP → pts = 100, pct = 100/148 ≈ 0.676
    // team C: 44W 28L 0OTL in 72 GP → pts = 88,  pct =  88/144 ≈ 0.611
    const A = team(1, { wins: 46, losses: 28, otl: 8, regWins: 38 });
    const B = team(2, { wins: 50, losses: 24, otl: 0, regWins: 50 });
    const C = team(3, { wins: 44, losses: 28, otl: 0, regWins: 44 });
    const { matrix } = matrixFrom([]);

    const sorted = sortWithTiebreakers([A, B, C], matrix, "nhl");
    // A and B have equal ptsPct; C is lower. Order within {A,B} resolved by regWins (B > A).
    expect(sorted[0].id).toBe(2); // B — more regWins among tied group
    expect(sorted[1].id).toBe(1); // A
    expect(sorted[2].id).toBe(3); // C
  });
});

describe("sortWithTiebreakers — NHL tiebreaker cascade", () => {
  it("breaks ptsPct tie by regWins", () => {
    // identical ptsPct (50W 24L 0OTL), different regWins
    const A = team(1, { wins: 50, losses: 24, otl: 0, regWins: 45 });
    const B = team(2, { wins: 50, losses: 24, otl: 0, regWins: 38 });
    const { matrix } = matrixFrom([]);

    const sorted = sortWithTiebreakers([B, A], matrix, "nhl");
    expect(sorted[0].id).toBe(1); // A — more regWins
    expect(sorted[1].id).toBe(2);
  });

  it("breaks ptsPct+regWins tie by H2H pts", () => {
    // Identical ptsPct and regWins; A beat B twice (regular season)
    const A = team(1, { wins: 50, losses: 24, otl: 0, regWins: 40 });
    const B = team(2, { wins: 50, losses: 24, otl: 0, regWins: 40 });
    const { matrix } = matrixFrom([
      { home: 1, away: 2, winner: 1, ot: false },
      { home: 2, away: 1, winner: 1, ot: false },
    ]);

    const sorted = sortWithTiebreakers([B, A], matrix, "nhl");
    expect(sorted[0].id).toBe(1); // A — more H2H pts against tied group
    expect(sorted[1].id).toBe(2);
  });

  it("gives 1 H2H pt for an OT loss (loser earns 1, winner earns 2)", () => {
    // A beat B in OT (B earns 1pt); B beat A in reg (A earns 0, B earns 2)
    // H2H pts: A=2, B=3 → B ranks higher
    const A = team(1, { wins: 50, losses: 24, otl: 0, regWins: 40 });
    const B = team(2, { wins: 50, losses: 24, otl: 0, regWins: 40 });
    const { matrix } = matrixFrom([
      { home: 1, away: 2, winner: 1, ot: true  }, // A wins OT → A gets 2pts, B gets 1pt (otLoss)
      { home: 2, away: 1, winner: 2, ot: false }, // B wins reg → B gets 2pts, A gets 0
    ]);

    const sorted = sortWithTiebreakers([A, B], matrix, "nhl");
    expect(sorted[0].id).toBe(2); // B: 3 H2H pts vs 2 for A
    expect(sorted[1].id).toBe(1);
  });

  it("breaks ptsPct+regWins+H2H tie by goal differential", () => {
    // Identical ptsPct, regWins, H2H pts; different pointDiff
    const A = team(1, { wins: 50, losses: 24, otl: 0, regWins: 40, pointDiff: 30 });
    const B = team(2, { wins: 50, losses: 24, otl: 0, regWins: 40, pointDiff: 15 });
    const { matrix } = matrixFrom([]);

    const sorted = sortWithTiebreakers([B, A], matrix, "nhl");
    expect(sorted[0].id).toBe(1); // A — better point diff
  });

  it("breaks full tie by goals for when pointDiff is also equal", () => {
    const A = team(1, { wins: 50, losses: 24, otl: 0, regWins: 40, pointDiff: 20, gf: 280 });
    const B = team(2, { wins: 50, losses: 24, otl: 0, regWins: 40, pointDiff: 20, gf: 265 });
    const { matrix } = matrixFrom([]);

    const sorted = sortWithTiebreakers([B, A], matrix, "nhl");
    expect(sorted[0].id).toBe(1); // A — more goals for
  });

  it("falls back to team id (deterministic) when all tiebreakers are equal", () => {
    const A = team(1, { wins: 50, losses: 24, otl: 0, regWins: 40, pointDiff: 20, gf: 280 });
    const B = team(2, { wins: 50, losses: 24, otl: 0, regWins: 40, pointDiff: 20, gf: 280 });
    const { matrix } = matrixFrom([]);

    const sorted = sortWithTiebreakers([B, A], matrix, "nhl");
    expect(sorted[0].id).toBe(1); // lower id wins
  });
});
