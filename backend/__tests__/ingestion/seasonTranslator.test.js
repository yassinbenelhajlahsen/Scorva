import { describe, it, expect } from "@jest/globals";
import { toEspnYear, decrementSeason, seasonMatchesLeague } from "../../src/ingestion/awards/seasonTranslator.js";

describe("seasonTranslator.toEspnYear", () => {
  it("translates NBA YYYY-YY to the ending year", () => {
    expect(toEspnYear("nba", "2025-26")).toBe(2026);
    expect(toEspnYear("nba", "2003-04")).toBe(2004);
    expect(toEspnYear("nba", "1999-00")).toBe(2000);
  });

  it("translates NHL YYYY-YY to the ending year", () => {
    expect(toEspnYear("nhl", "2024-25")).toBe(2025);
    expect(toEspnYear("nhl", "2023-24")).toBe(2024);
  });

  it("returns NFL YYYY as-is", () => {
    expect(toEspnYear("nfl", "2024")).toBe(2024);
    expect(toEspnYear("nfl", "2003")).toBe(2003);
  });

  it("is case-insensitive on the league", () => {
    expect(toEspnYear("NBA", "2024-25")).toBe(2025);
    expect(toEspnYear("Nfl", "2023")).toBe(2023);
  });

  it("throws on malformed NBA/NHL season string", () => {
    expect(() => toEspnYear("nba", "2024")).toThrow(/Invalid NBA season/);
    expect(() => toEspnYear("nhl", "abc")).toThrow(/Invalid NHL season/);
    expect(() => toEspnYear("nba", "2024-2025")).toThrow();
  });

  it("throws on malformed NFL season string", () => {
    expect(() => toEspnYear("nfl", "2024-25")).toThrow(/Invalid NFL season/);
    expect(() => toEspnYear("nfl", "abcd")).toThrow();
  });

  it("throws on unsupported league", () => {
    expect(() => toEspnYear("mlb", "2024")).toThrow(/Unsupported league/);
  });

  it("throws on non-string input", () => {
    expect(() => toEspnYear("nba", 2024)).toThrow();
    expect(() => toEspnYear("nba", null)).toThrow();
  });
});

describe("seasonTranslator.seasonMatchesLeague", () => {
  it("matches NBA/NHL with YYYY-YY", () => {
    expect(seasonMatchesLeague("nba", "2025-26")).toBe(true);
    expect(seasonMatchesLeague("nhl", "2024-25")).toBe(true);
  });

  it("matches NFL with YYYY", () => {
    expect(seasonMatchesLeague("nfl", "2024")).toBe(true);
  });

  it("rejects mismatched formats", () => {
    expect(seasonMatchesLeague("nfl", "2024-25")).toBe(false);
    expect(seasonMatchesLeague("nba", "2024")).toBe(false);
    expect(seasonMatchesLeague("nhl", "abc")).toBe(false);
  });

  it("rejects non-string and unknown leagues", () => {
    expect(seasonMatchesLeague("nba", 2024)).toBe(false);
    expect(seasonMatchesLeague("mlb", "2024")).toBe(false);
  });
});

describe("seasonTranslator.decrementSeason", () => {
  it("decrements NBA seasons", () => {
    expect(decrementSeason("nba", "2025-26")).toBe("2024-25");
    expect(decrementSeason("nba", "2000-01")).toBe("1999-00");
  });

  it("decrements NHL seasons", () => {
    expect(decrementSeason("nhl", "2024-25")).toBe("2023-24");
  });

  it("decrements NFL seasons", () => {
    expect(decrementSeason("nfl", "2024")).toBe("2023");
  });

  it("throws on malformed season", () => {
    expect(() => decrementSeason("nba", "abc")).toThrow();
    expect(() => decrementSeason("nfl", "2024-25")).toThrow();
  });
});
