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

  it("includes hasUnplayedPriorSeriesGames key", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("'hasUnplayedPriorSeriesGames'");
  });

  it("uses strict less-than for prior series games and excludes finals/cancellations", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("g3.id < g.id");
    expect(sql).toContain("g3.status NOT ILIKE 'Final%'");
    expect(sql).toContain("g3.status NOT ILIKE 'Cancel%'");
  });

  it("filters play-in games out of the unplayed-prior subquery", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("g3.game_label NOT ILIKE '%play-in%'");
  });

  it("includes hasUnplayedPriorSeriesGames for nhl", () => {
    const sql = buildGameDetailSQL("nhl");
    expect(sql).toContain("'hasUnplayedPriorSeriesGames'");
  });

  it("includes hasUnplayedPriorSeriesGames for nfl (always-false at runtime)", () => {
    const sql = buildGameDetailSQL("nfl");
    expect(sql).toContain("'hasUnplayedPriorSeriesGames'");
  });
});
