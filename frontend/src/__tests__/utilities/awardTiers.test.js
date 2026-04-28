import { describe, it, expect } from "vitest";
import { tierFor, priorityFor, groupAwards } from "../../utils/awardTiers.js";

describe("awardTiers.tierFor", () => {
  it("classifies career-defining awards as legendary", () => {
    expect(tierFor("mvp")).toBe("legendary");
    expect(tierFor("champion")).toBe("legendary");
    expect(tierFor("finals_mvp")).toBe("legendary");
    expect(tierFor("super_bowl_mvp")).toBe("legendary");
    expect(tierFor("conn_smythe")).toBe("legendary");
  });

  it("classifies position/role awards and 1st-team selections as major", () => {
    expect(tierFor("dpoy")).toBe("major");
    expect(tierFor("opoy")).toBe("major");
    expect(tierFor("roy")).toBe("major");
    expect(tierFor("calder")).toBe("major");
    expect(tierFor("norris")).toBe("major");
    expect(tierFor("vezina")).toBe("major");
    expect(tierFor("all_nba_first")).toBe("major");
    expect(tierFor("all_pro_first")).toBe("major");
    expect(tierFor("nhl_all_star_first")).toBe("major");
  });

  it("classifies game/team selections as selection", () => {
    expect(tierFor("all_star")).toBe("selection");
    expect(tierFor("pro_bowl")).toBe("selection");
    expect(tierFor("all_nba_second")).toBe("selection");
    expect(tierFor("all_nba_third")).toBe("selection");
    expect(tierFor("all_defensive_first")).toBe("selection");
    expect(tierFor("all_rookie_first")).toBe("selection");
  });

  it("falls back to selection for unknown types", () => {
    expect(tierFor("totally_new_award")).toBe("selection");
  });
});

describe("awardTiers.groupAwards", () => {
  const awards = [
    { type: "all_star", count: 19, label: "All-Star", seasons: [] },
    { type: "champion", count: 4, label: "Champion", seasons: [] },
    { type: "mvp", count: 4, label: "MVP", seasons: [] },
    { type: "finals_mvp", count: 4, label: "Finals MVP", seasons: [] },
    { type: "all_nba_first", count: 13, label: "All-NBA 1st", seasons: [] },
    { type: "dpoy", count: 1, label: "Defensive POY", seasons: [] },
  ];

  it("groups awards into legendary / major / selection buckets", () => {
    const groups = groupAwards(awards);
    expect(groups.legendary.map((a) => a.type)).toEqual(
      expect.arrayContaining(["mvp", "champion", "finals_mvp"]),
    );
    expect(groups.major.map((a) => a.type)).toEqual(
      expect.arrayContaining(["dpoy", "all_nba_first"]),
    );
    expect(groups.selection.map((a) => a.type)).toEqual(["all_star"]);
  });

  it("orders legendary by curated priority (MVP, Champion, Finals MVP)", () => {
    const { legendary } = groupAwards(awards);
    expect(legendary.map((a) => a.type)).toEqual(["mvp", "champion", "finals_mvp"]);
  });

  it("breaks ties within a tier by descending count", () => {
    const tied = [
      { type: "dpoy", count: 1 },
      { type: "opoy", count: 3 },
      { type: "norris", count: 7 },
    ];
    const { major } = groupAwards(tied);
    // All three share priority 10; count desc → norris, opoy, dpoy
    expect(major.map((a) => a.type)).toEqual(["norris", "opoy", "dpoy"]);
  });

  it("handles empty/undefined input", () => {
    expect(groupAwards()).toEqual({ legendary: [], major: [], selection: [] });
    expect(groupAwards([])).toEqual({ legendary: [], major: [], selection: [] });
  });
});

describe("awardTiers.priorityFor", () => {
  it("returns lower numbers for more prestigious awards", () => {
    expect(priorityFor("mvp")).toBeLessThan(priorityFor("dpoy"));
    expect(priorityFor("dpoy")).toBeLessThan(priorityFor("all_star"));
    expect(priorityFor("all_nba_first")).toBeLessThan(priorityFor("all_nba_second"));
  });

  it("returns a high default for unknown types", () => {
    expect(priorityFor("totally_new_award")).toBeGreaterThanOrEqual(99);
  });
});
