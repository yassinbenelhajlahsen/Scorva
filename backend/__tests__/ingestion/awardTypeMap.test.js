import { describe, it, expect } from "@jest/globals";
import { mapEspnAward, displayLabel, isKnownOutOfScope, KNOWN_AWARD_TYPES } from "../../src/ingestion/awards/awardTypeMap.js";

describe("awardTypeMap.mapEspnAward", () => {
  describe("NBA", () => {
    it.each([
      ["MVP", "mvp", "standard"],
      ["Most Valuable Player", "mvp", "standard"],
      ["Finals MVP", "finals_mvp", "championship"],
      ["Bill Russell NBA Finals MVP", "finals_mvp", "championship"],
      ["Rookie of the Year", "roy", "standard"],
      ["Defensive Player of the Year", "dpoy", "standard"],
      ["Most Improved Player", "mip", "standard"],
      ["Sixth Man of the Year", "sixth_man", "standard"],
      ["All-NBA First Team", "all_nba_first", "standard"],
      ["All-NBA Second Team", "all_nba_second", "standard"],
      ["All-NBA Third Team", "all_nba_third", "standard"],
      ["All-NBA 1st Team", "all_nba_first", "standard"],
      ["All-NBA 2nd Team", "all_nba_second", "standard"],
      ["All-NBA 3rd Team", "all_nba_third", "standard"],
      ["All-Defensive First Team", "all_defensive_first", "standard"],
      ["All-Defensive Second Team", "all_defensive_second", "standard"],
      ["All-Defensive 1st Team", "all_defensive_first", "standard"],
      ["All-Defensive 2nd Team", "all_defensive_second", "standard"],
      ["All-Rookie 1st Team", "all_rookie_first", "standard"],
      ["All-Rookie 2nd Team", "all_rookie_second", "standard"],
      ["All-Star MVP", "all_star_mvp", "standard"],
      ["NBA Cup MVP", "cup_mvp", "standard"],
      ["NBA Cup All-Tournament Team", "cup_all_tournament", "standard"],
      ["Clutch Player of the Year", "clutch_poy", "standard"],
      ["Twyman-Stokes Teammate of the Year Award", "teammate_of_year", "standard"],
      ["NBA Eastern Conference Finals MVP", "east_finals_mvp", "standard"],
      ["NBA Western Conference Finals MVP", "west_finals_mvp", "standard"],
      ["Scoring Leader", "scoring_champ", "standard"],
      ["All-Star", "all_star", "standard"],
      ["NBA Champion", "champion", "championship"],
    ])("maps NBA '%s' → %s (%s)", (espnName, awardType, tier) => {
      expect(mapEspnAward("nba", espnName)).toEqual({ awardType, tier });
    });
  });

  describe("NFL", () => {
    it.each([
      ["MVP", "mvp", "standard"],
      ["Super Bowl MVP", "super_bowl_mvp", "championship"],
      ["Super Bowl Champion", "champion", "championship"],
      ["Pro Bowl", "pro_bowl", "standard"],
      ["All-Pro First Team", "all_pro_first", "standard"],
      ["All-Pro Second Team", "all_pro_second", "standard"],
      ["All-Pro 1st Team", "all_pro_first", "standard"],
      ["All-Pro 2nd Team", "all_pro_second", "standard"],
      ["Offensive Player of the Year", "opoy", "standard"],
      ["Defensive Player of the Year", "dpoy", "standard"],
      ["Offensive Rookie of the Year", "oroy", "standard"],
      ["Defensive Rookie of the Year", "droy", "standard"],
      ["Comeback Player of the Year", "comeback_poy", "standard"],
      ["Walter Payton Man of the Year", "walter_payton", "standard"],
    ])("maps NFL '%s' → %s (%s)", (espnName, awardType, tier) => {
      expect(mapEspnAward("nfl", espnName)).toEqual({ awardType, tier });
    });
  });

  describe("NHL", () => {
    it.each([
      ["Hart Trophy", "mvp", "standard"],
      ["Hart Memorial Trophy", "mvp", "standard"],
      ["Conn Smythe Trophy", "conn_smythe", "championship"],
      ["Stanley Cup Champion", "champion", "championship"],
      ["Calder Trophy", "calder", "standard"],
      ["All-Star", "all_star", "standard"],
      ["First All-Star Team", "nhl_all_star_first", "standard"],
      ["Second All-Star Team", "nhl_all_star_second", "standard"],
      ["1st All-Star Team", "nhl_all_star_first", "standard"],
      ["2nd All-Star Team", "nhl_all_star_second", "standard"],
      ["Art Ross Trophy", "art_ross", "standard"],
      ["Maurice Richard Trophy", "richard", "standard"],
      ["William Jennings Trophy", "jennings", "standard"],
      ["Norris Trophy", "norris", "standard"],
      ["James Norris Memorial Trophy", "norris", "standard"],
      ["Vezina Trophy", "vezina", "standard"],
      ["Selke Trophy", "selke", "standard"],
      ["Frank J. Selke Trophy", "selke", "standard"],
      ["Lady Byng Trophy", "lady_byng", "standard"],
      ["Lady Byng Memorial Trophy", "lady_byng", "standard"],
      ["Ted Lindsay Award", "ted_lindsay", "standard"],
      ["Mark Messier NHL Leadership Award", "messier_leadership", "standard"],
      ["Bill Masterton Memorial Trophy", "masterton", "standard"],
      ["King Clancy Memorial Trophy", "king_clancy", "standard"],
    ])("maps NHL '%s' → %s (%s)", (espnName, awardType, tier) => {
      expect(mapEspnAward("nhl", espnName)).toEqual({ awardType, tier });
    });
  });

  it("is case-insensitive", () => {
    expect(mapEspnAward("nba", "mvp")).toEqual({ awardType: "mvp", tier: "standard" });
    expect(mapEspnAward("nba", "MVP")).toEqual({ awardType: "mvp", tier: "standard" });
    expect(mapEspnAward("NBA", "MVP")).toEqual({ awardType: "mvp", tier: "standard" });
  });

  it("trims whitespace", () => {
    expect(mapEspnAward("nba", "  MVP  ")).toEqual({ awardType: "mvp", tier: "standard" });
  });

  it("returns null for unknown award", () => {
    expect(mapEspnAward("nba", "Some Made-Up Award")).toBeNull();
  });

  it("returns null for unknown league", () => {
    expect(mapEspnAward("mlb", "MVP")).toBeNull();
  });

  it("returns null for null/empty inputs", () => {
    expect(mapEspnAward("nba", null)).toBeNull();
    expect(mapEspnAward("nba", "")).toBeNull();
    expect(mapEspnAward(null, "MVP")).toBeNull();
  });
});

describe("awardTypeMap.displayLabel", () => {
  it("returns human-readable labels for known types", () => {
    expect(displayLabel("mvp")).toBe("MVP");
    expect(displayLabel("finals_mvp")).toBe("Finals MVP");
    expect(displayLabel("all_nba_first")).toBe("All-NBA 1st");
    expect(displayLabel("conn_smythe")).toBe("Conn Smythe");
  });

  it("falls back to the raw type for unknown keys", () => {
    expect(displayLabel("totally_unknown")).toBe("totally_unknown");
  });
});

describe("awardTypeMap.isKnownOutOfScope", () => {
  it("flags non-player NBA awards (coach, executive, etc.)", () => {
    expect(isKnownOutOfScope("nba", "Coach of the Year")).toBe(true);
    expect(isKnownOutOfScope("nba", "Executive of the Year")).toBe(true);
    expect(isKnownOutOfScope("nba", "Social Justice Champion")).toBe(true);
  });

  it("flags non-player NFL awards (coach)", () => {
    expect(isKnownOutOfScope("nfl", "Coach of the Year")).toBe(true);
  });

  it("flags non-player NHL awards (coach)", () => {
    expect(isKnownOutOfScope("nhl", "Jack Adams Award")).toBe(true);
  });

  it("returns false for in-scope player awards", () => {
    expect(isKnownOutOfScope("nba", "MVP")).toBe(false);
    expect(isKnownOutOfScope("nba", "All-Star MVP")).toBe(false);
    expect(isKnownOutOfScope("nhl", "Art Ross Trophy")).toBe(false);
    expect(isKnownOutOfScope("nhl", "Hart Trophy")).toBe(false);
  });

  it("returns false for genuinely unknown awards", () => {
    expect(isKnownOutOfScope("nba", "Made-Up Award")).toBe(false);
  });

  it("returns false for null/empty/unknown league", () => {
    expect(isKnownOutOfScope("nba", null)).toBe(false);
    expect(isKnownOutOfScope("mlb", "MVP")).toBe(false);
  });
});

describe("KNOWN_AWARD_TYPES", () => {
  it("includes the championship-tier types", () => {
    expect(KNOWN_AWARD_TYPES).toEqual(
      expect.arrayContaining(["mvp", "champion", "finals_mvp", "super_bowl_mvp", "conn_smythe"]),
    );
  });
});
