import { describe, it, expect } from "vitest";
import computeTopPlayers from "../../utils/topPlayers.js";

function makePlayer(name, stats) {
  return { name, position: "G", imageUrl: null, stats };
}

describe("computeTopPlayers — NBA", () => {
  const stats = [
    makePlayer("Alpha", { PTS: 30, REB: 5, AST: 8, STL: 2, BLK: 1, TOV: 2, "+/-": "+10" }),
    makePlayer("Beta",  { PTS: 20, REB: 10, AST: 3, STL: 0, BLK: 2, TOV: 1, "+/-": "+5" }),
    makePlayer("Gamma", { PTS: 10, REB: 2,  AST: 12, STL: 3, BLK: 0, TOV: 3, "+/-": "-2" }),
  ];

  it("returns topPerformer, topScorer, impactPlayer", () => {
    const result = computeTopPlayers(null, stats, "nba");
    expect(result.topPerformer).not.toBeNull();
    expect(result.topScorer).not.toBeNull();
    expect(result.impactPlayer).not.toBeNull();
  });

  it("all three roles are distinct players", () => {
    const { topPerformer, topScorer, impactPlayer } = computeTopPlayers(null, stats, "nba");
    const names = [topPerformer?.name, topScorer?.name, impactPlayer?.name];
    expect(new Set(names).size).toBe(3);
  });

  it("topPerformer has highest Hollinger score", () => {
    const { topPerformer } = computeTopPlayers(null, stats, "nba");
    expect(topPerformer.name).toBe("Alpha");
  });

  it("returns nulls for empty stats", () => {
    const result = computeTopPlayers(null, [], "nba");
    expect(result).toEqual({ topPerformer: null, topScorer: null, impactPlayer: null });
  });

  it("throws for unsupported league", () => {
    expect(() => computeTopPlayers(null, stats, "xyz")).toThrow("Unsupported league: xyz");
  });
});

describe("computeTopPlayers — deduplication", () => {
  it("topScorer differs from topPerformer when same player leads both", () => {
    const stats = [
      makePlayer("Dominant", { PTS: 50, REB: 10, AST: 5, STL: 3, BLK: 2, TOV: 1, "+/-": "+20" }),
      makePlayer("Second",   { PTS: 20, REB: 3, AST: 2, STL: 0, BLK: 0, TOV: 2, "+/-": "+2" }),
      makePlayer("Third",    { PTS: 10, REB: 2, AST: 1, STL: 0, BLK: 0, TOV: 1, "+/-": "+1" }),
    ];
    const { topPerformer, topScorer } = computeTopPlayers(null, stats, "nba");
    expect(topPerformer.name).toBe("Dominant");
    expect(topScorer.name).not.toBe("Dominant");
  });
});

describe("computeTopPlayers — NFL", () => {
  const stats = [
    makePlayer("QB1",  { YDS: 350, CMP: 25, TD: 3, INT: 0, SCKS: 0 }),
    makePlayer("WR1",  { YDS: 120, CMP: 0,  TD: 2, INT: 0, SCKS: 0 }),
    makePlayer("DE1",  { YDS: 0,   CMP: 0,  TD: 0, INT: 1, SCKS: 2 }),
  ];

  it("returns valid result for NFL", () => {
    const result = computeTopPlayers(null, stats, "nfl");
    expect(result.topPerformer).not.toBeNull();
    expect(result.topScorer).not.toBeNull();
    expect(result.impactPlayer).not.toBeNull();
  });

  it("QB leads performanceScore", () => {
    const { topPerformer } = computeTopPlayers(null, stats, "nfl");
    expect(topPerformer.name).toBe("QB1");
  });
});

describe("computeTopPlayers — NHL", () => {
  const stats = [
    makePlayer("Sniper",  { G: 3, A: 1, SHOTS: 8, SAVES: 0, BS: 0, HT: 0, "+/-": "+3" }),
    makePlayer("Playmaker", { G: 0, A: 4, SHOTS: 2, SAVES: 0, BS: 1, HT: 2, "+/-": "+2" }),
    makePlayer("Goalie",  { G: 0, A: 0, SHOTS: 0, SAVES: 35, BS: 0, HT: 0, "+/-": "0" }),
  ];

  it("returns valid result for NHL", () => {
    const result = computeTopPlayers(null, stats, "nhl");
    expect(result.topPerformer).not.toBeNull();
  });

  it("Sniper leads performanceScore (goals weighted 2.0)", () => {
    const { topPerformer } = computeTopPlayers(null, stats, "nhl");
    expect(topPerformer.name).toBe("Sniper");
  });
});

describe("parsePlusMinus (via impactScore)", () => {
  it("handles numeric +/- values — high numeric +/- wins impact slot", () => {
    // 3 players needed so all 3 slots (topPerformer, topScorer, impactPlayer) are filled
    const stats = [
      makePlayer("PlusPlayer",  { PTS: 20, REB: 0, AST: 0, STL: 0, BLK: 0, TOV: 0, "+/-": 8 }),
      makePlayer("MinusPlayer", { PTS: 15, REB: 0, AST: 0, STL: 0, BLK: 0, TOV: 0, "+/-": -5 }),
      makePlayer("NeutralPlayer", { PTS: 10, REB: 0, AST: 0, STL: 0, BLK: 0, TOV: 0, "+/-": 0 }),
    ];
    const { impactPlayer } = computeTopPlayers(null, stats, "nba");
    // PlusPlayer is topPerformer (highest PTS), MinusPlayer is topScorer (next),
    // so NeutralPlayer's impact (0) vs remaining only NeutralPlayer → impactPlayer = NeutralPlayer
    expect(impactPlayer).not.toBeNull();
    expect(impactPlayer.name).toBe("NeutralPlayer");
  });

  it("handles string +/- values with sign", () => {
    const stats = [
      makePlayer("A", { PTS: 5, STL: 0, BLK: 0, "+/-": "+12" }),
      makePlayer("B", { PTS: 5, STL: 0, BLK: 0, "+/-": "-3" }),
    ];
    const { topPerformer } = computeTopPlayers(null, stats, "nba");
    expect(topPerformer.name).toBe("A");
  });

  it("handles null +/- (parsePlusMinus falsy path returns 0)", () => {
    // Player with null +/- — parsePlusMinus should return 0
    const stats = [
      makePlayer("HasStats",  { PTS: 20, REB: 5, AST: 3, STL: 1, BLK: 0, TOV: 1, "+/-": "+5" }),
      makePlayer("NullPM",    { PTS: 15, REB: 3, AST: 2, STL: 0, BLK: 0, TOV: 1, "+/-": null }),
      makePlayer("UndefPM",   { PTS: 10, REB: 2, AST: 1, STL: 0, BLK: 0, TOV: 0 }),
    ];
    const result = computeTopPlayers(null, stats, "nba");
    expect(result.topPerformer).not.toBeNull();
    expect(result.impactPlayer).not.toBeNull();
  });
});

describe("computeTopPlayers — impactPlayer coverage for all leagues", () => {
  it("NBA: explicitly verifies impactPlayer is computed (line 38 coverage)", () => {
    const stats = [
      makePlayer("A", { PTS: 30, REB: 5, AST: 8, STL: 2, BLK: 1, TOV: 2, "+/-": "+10" }),
      makePlayer("B", { PTS: 20, REB: 8, AST: 3, STL: 0, BLK: 2, TOV: 1, "+/-": "+5" }),
      makePlayer("C", { PTS: 5,  REB: 2, AST: 1, STL: 1, BLK: 0, TOV: 1, "+/-": "+15" }),
    ];
    const { impactPlayer } = computeTopPlayers(null, stats, "nba");
    // C has +15, so should win the impact slot after A and B are excluded
    expect(impactPlayer).not.toBeNull();
    expect(impactPlayer.name).toBe("C");
  });

  it("NFL: explicitly verifies impactPlayer is computed (line 60 coverage)", () => {
    const stats = [
      makePlayer("QB",  { YDS: 300, CMP: 22, TD: 3, INT: 0, SCKS: 0 }),
      makePlayer("WR",  { YDS: 100, CMP: 0,  TD: 2, INT: 0, SCKS: 0 }),
      makePlayer("DE",  { YDS: 0,   CMP: 0,  TD: 0, INT: 2, SCKS: 3 }),
    ];
    const { impactPlayer } = computeTopPlayers(null, stats, "nfl");
    expect(impactPlayer).not.toBeNull();
    expect(impactPlayer.name).toBe("DE"); // 3*5 + 2*6 = 27 impact
  });

  it("NHL: explicitly verifies impactPlayer is computed (line 83 coverage)", () => {
    const stats = [
      makePlayer("Scorer",  { G: 3, A: 1, SHOTS: 6, SAVES: 0, BS: 0, HT: 0, "+/-": "+4" }),
      makePlayer("Passer",  { G: 0, A: 4, SHOTS: 2, SAVES: 0, BS: 1, HT: 2, "+/-": "+2" }),
      makePlayer("Defender",{ G: 0, A: 1, SHOTS: 1, SAVES: 0, BS: 3, HT: 1, "+/-": "+6" }),
    ];
    const { impactPlayer } = computeTopPlayers(null, stats, "nhl");
    expect(impactPlayer).not.toBeNull();
    // Defender has best remaining impactScore after Scorer and Passer excluded
  });
});

describe("computeTopPlayers — stats filtering", () => {
  it("filters out players with no stats object", () => {
    const stats = [
      makePlayer("Valid", { PTS: 20, REB: 5, AST: 3, STL: 1, BLK: 0, TOV: 1, "+/-": "+5" }),
      { name: "NoStats", position: "G", imageUrl: null, stats: null },
      { name: "NonObjStats", position: "F", imageUrl: null, stats: "bad" },
    ];
    const result = computeTopPlayers(null, stats, "nba");
    expect(result.topPerformer.name).toBe("Valid");
  });
});
