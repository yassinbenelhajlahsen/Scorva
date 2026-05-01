import { describe, it, expect } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { PLAYER_TIER, tierCaseSql } = await import(
  resolve(__dirname, "../../src/services/streaks/streakTiers.js"),
);

describe("PLAYER_TIER", () => {
  it("ranks NBA labels with triple-double first and 10+ rebound last", () => {
    expect(PLAYER_TIER.nba[0]).toBe("triple-double");
    expect(PLAYER_TIER.nba[PLAYER_TIER.nba.length - 1]).toBe("10+ rebound");
  });

  it("includes labels for nfl and nhl", () => {
    expect(PLAYER_TIER.nfl).toContain("250+ pass yard");
    expect(PLAYER_TIER.nhl).toContain("multi-point");
  });
});

describe("tierCaseSql", () => {
  it("emits a CASE expression with one WHEN per label and ELSE 99", () => {
    const sql = tierCaseSql(["a", "b", "c"], "stat_label");
    expect(sql).toMatch(/^CASE stat_label/);
    expect(sql).toMatch(/WHEN 'a' THEN 0/);
    expect(sql).toMatch(/WHEN 'b' THEN 1/);
    expect(sql).toMatch(/WHEN 'c' THEN 2/);
    expect(sql).toMatch(/ELSE 99 END$/);
  });

  it("escapes single quotes in labels", () => {
    const sql = tierCaseSql(["it's"], "x");
    expect(sql).toMatch(/WHEN 'it''s' THEN 0/);
  });
});
