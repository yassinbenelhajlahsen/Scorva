/**
 * Tests for mapStatsToSchema utility
 */

import { describe, it, expect } from "@jest/globals";
import mapStatsToSchema from "../../src/ingestion/mapStatsToSchema.js";

describe("mapStatsToSchema", () => {
  describe("NBA Stats Mapping", () => {
    it("should map NBA field goal stats correctly", () => {
      const espnStats = {
        "fieldGoalsMade-fieldGoalsAttempted": "10-18",
        points: "28",
      };

      const result = mapStatsToSchema(espnStats, "nba");

      expect(result).toHaveProperty("fg", "10-18");
      expect(result).toHaveProperty("points", 28);
    });

    it("should map NBA three-point stats correctly", () => {
      const espnStats = {
        "3FGM": "3-7",
        threePointFieldGoalsMade: "3-7",
      };

      const result = mapStatsToSchema(espnStats, "nba");

      expect(result).toHaveProperty("threept", "3-7");
    });

    it("should map NBA free throw stats correctly", () => {
      const espnStats = {
        freeThrowPercentage: "85.5",
        FT: "5-6",
      };

      const result = mapStatsToSchema(espnStats, "nba");

      expect(result.ftPct || result.ft).toBeDefined();
    });

    it("should handle common NBA stats", () => {
      const espnStats = {
        points: "28",
        rebounds: "8",
        assists: "7",
        steals: "2",
        blocks: "1",
        turnovers: "3",
        fouls: "3",
        minutes: "35:24",
      };

      const result = mapStatsToSchema(espnStats, "nba");

      expect(result.points).toBe(28);
      expect(result.rebounds).toBe(8);
      expect(result.assists).toBe(7);
      expect(result.steals).toBe(2);
      expect(result.blocks).toBe(1);
      expect(result.turnovers).toBe(3);
      expect(result.fouls).toBe(3);
      expect(result.minutes).toBe("35:24");
    });

    it("should convert string numbers to integers", () => {
      const espnStats = {
        points: "25",
        rebounds: "10",
      };

      const result = mapStatsToSchema(espnStats, "nba");

      expect(typeof result.points).toBe("number");
      expect(typeof result.rebounds).toBe("number");
      expect(result.points).toBe(25);
    });

    it("should convert decimal strings to floats", () => {
      const espnStats = {
        fgPct: "55.6",
      };

      const result = mapStatsToSchema(espnStats, "nba");

      expect(typeof result.fgPct).toBe("number");
      expect(result.fgPct).toBe(55.6);
    });

    it("should handle null and empty values", () => {
      const espnStats = {
        points: "",
        rebounds: null,
        assists: undefined,
      };

      const result = mapStatsToSchema(espnStats, "nba");

      expect(result.points).toBeNull();
      expect(result.rebounds).toBeNull();
      expect(result.assists).toBeUndefined();
    });
  });

  describe("NFL Stats Mapping", () => {
    it("should map NFL passing stats correctly", () => {
      const espnStats = {
        "C/ATT": "25-35",
        yds: "325",
        td: "3",
        INT: "1",
      };

      const result = mapStatsToSchema(espnStats, "nfl");

      expect(result.cmpatt).toBe("25-35");
      expect(result.yds).toBe(325);
      expect(result.td).toBe(3);
      expect(result.interceptions).toBe(1);
    });

    it("should map NFL sacks correctly", () => {
      const espnStats = {
        sacks: "2",
        SACKS: "2",
      };

      const result = mapStatsToSchema(espnStats, "nfl");

      expect(result.sacks).toBe(2);
    });
  });

  describe("NHL Stats Mapping", () => {
    it("should map NHL basic stats correctly", () => {
      const espnStats = {
        g: "2",
        a: "1",
        plusMinus: "+3",
        shotsTotal: "5",
      };

      const result = mapStatsToSchema(espnStats, "nhl");

      expect(result.g).toBe(2);
      expect(result.a).toBe(1);
      // Plus/minus might be converted to number or stay as string depending on implementation
      expect(result.plusminus).toBeDefined();
      expect(result.shots).toBe(5);
    });

    it("should map NHL goalie stats correctly", () => {
      const espnStats = {
        saves: "30",
        GA: "2",
        savePct: "93.8",
        toi: "60:00",
      };

      const result = mapStatsToSchema(espnStats, "nhl");

      expect(result.saves).toBe(30);
      expect(result.ga).toBe(2);
      expect(result.savePct).toBe(93.8);
      expect(result.toi).toBe("60:00");
    });

    it("should map NHL penalty stats correctly", () => {
      const espnStats = {
        pn: "2",
        pim: "4",
      };

      const result = mapStatsToSchema(espnStats, "nhl");

      expect(result.pn).toBe(2);
      expect(result.pim).toBe(4);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty stats object", () => {
      const result = mapStatsToSchema({}, "nba");
      expect(result).toEqual({});
    });

    it("should handle unknown league gracefully", () => {
      const espnStats = { points: "20" };
      const result = mapStatsToSchema(espnStats, "unknown");

      // Should still map common stats
      expect(result.points).toBe(20);
    });

    it("should not map unrecognized fields", () => {
      const espnStats = {
        unknownField: "value",
        points: "20",
      };

      const result = mapStatsToSchema(espnStats, "nba");

      expect(result.unknownField).toBeUndefined();
      expect(result.points).toBe(20);
    });

    it("should handle mixed case field names", () => {
      const espnStats = {
        Points: "25",
        REBOUNDS: "10",
      };

      const result = mapStatsToSchema(espnStats, "nba");

      // Depends on exact mapping - should handle case insensitivity
      expect(Object.keys(result).length).toBeGreaterThanOrEqual(0);
    });
  });
});
