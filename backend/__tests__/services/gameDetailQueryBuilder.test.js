import { describe, it, expect } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { buildGameDetailSQL } = await import(
  resolve(__dirname, "../../src/services/games/gameDetailQueryBuilder.js")
);

describe("buildGameDetailSQL", () => {
  it("throws for unknown league", () => {
    expect(() => buildGameDetailSQL("xyz")).toThrow("Unknown league");
  });

  it("includes seriesScore key in game json_build_object", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("'seriesScore'");
  });

  it("includes homeWins and awayWins in seriesScore", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("'homeWins'");
    expect(sql).toContain("'awayWins'");
  });

  it("includes the lateral series subquery with nba/nhl guard", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("LEFT JOIN LATERAL");
    expect(sql).toContain("home_series_wins");
    expect(sql).toContain("away_series_wins");
    expect(sql).toContain("'nba'");
    expect(sql).toContain("'nhl'");
  });

  it("works for nhl league", () => {
    const sql = buildGameDetailSQL("nhl");
    expect(sql).toContain("'seriesScore'");
    expect(sql).toContain("LEFT JOIN LATERAL");
  });
});
