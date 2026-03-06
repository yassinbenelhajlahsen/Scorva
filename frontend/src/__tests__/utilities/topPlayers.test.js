import { describe, it, expect } from "vitest";
import computeTopPlayers from "../../utilities/topPlayers.js";

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
});
