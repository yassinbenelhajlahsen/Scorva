import { describe, it, expect } from "vitest";
import teamUrl from "../../utils/teamUrl.js";

describe("teamUrl", () => {
  it("uses lowercased abbreviation when present", () => {
    expect(teamUrl("nba", { abbreviation: "LAL", name: "Los Angeles Lakers" }))
      .toBe("/nba/teams/lal");
  });

  it("handles already-lowercase abbreviation", () => {
    expect(teamUrl("nfl", { abbreviation: "kc", name: "Kansas City Chiefs" }))
      .toBe("/nfl/teams/kc");
  });

  it("falls back to slugified name when abbreviation missing", () => {
    expect(teamUrl("nba", { name: "Los Angeles Lakers" }))
      .toBe("/nba/teams/los-angeles-lakers");
  });

  it("falls back to slugified name when abbreviation is empty string", () => {
    expect(teamUrl("nhl", { abbreviation: "", name: "Boston Bruins" }))
      .toBe("/nhl/teams/boston-bruins");
  });

  it("returns /:league/teams/ when team has neither abbreviation nor name", () => {
    expect(teamUrl("nba", {})).toBe("/nba/teams/");
  });

  it("tolerates a null team", () => {
    expect(teamUrl("nba", null)).toBe("/nba/teams/");
  });
});
