import { describe, it, expect } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { default: commonMappings } = await import(
  resolve(__dirname, "../../src/ingestion/commonMappings.js")
);

describe("commonMappings", () => {
  describe("structure", () => {
    it("exports a non-null object", () => {
      expect(commonMappings).toBeDefined();
      expect(typeof commonMappings).toBe("object");
      expect(commonMappings).not.toBeNull();
    });

    it("every entry is a non-empty array of strings", () => {
      for (const [key, aliases] of Object.entries(commonMappings)) {
        expect(Array.isArray(aliases)).toBe(true);
        expect(aliases.length).toBeGreaterThan(0);
        for (const alias of aliases) {
          expect(typeof alias).toBe("string");
        }
        // suppress unused-variable lint
        void key;
      }
    });

    it("contains all expected stat keys", () => {
      const expectedKeys = [
        "points",
        "assists",
        "rebounds",
        "blocks",
        "steals",
        "turnovers",
        "plusminus",
        "minutes",
        "fouls",
        "fg",
        "threept",
        "ft",
        "td",
      ];
      for (const key of expectedKeys) {
        expect(commonMappings).toHaveProperty(key);
      }
    });
  });

  describe("points", () => {
    it("includes 'points' alias", () => {
      expect(commonMappings.points).toContain("points");
    });

    it("includes 'pts' alias", () => {
      expect(commonMappings.points).toContain("pts");
    });

    it("includes 'PTS' alias", () => {
      expect(commonMappings.points).toContain("PTS");
    });
  });

  describe("assists", () => {
    it("includes 'assists' alias", () => {
      expect(commonMappings.assists).toContain("assists");
    });

    it("includes 'AST' alias", () => {
      expect(commonMappings.assists).toContain("AST");
    });
  });

  describe("rebounds", () => {
    it("includes 'rebounds' alias", () => {
      expect(commonMappings.rebounds).toContain("rebounds");
    });

    it("includes 'REB' alias", () => {
      expect(commonMappings.rebounds).toContain("REB");
    });
  });

  describe("fg (field goals)", () => {
    it("includes 'fgPct' alias", () => {
      expect(commonMappings.fg).toContain("fgPct");
    });

    it("includes split 'fieldGoalsMade-fieldGoalsAttempted' alias", () => {
      expect(commonMappings.fg).toContain("fieldGoalsMade-fieldGoalsAttempted");
    });
  });

  describe("threept (three-point field goals)", () => {
    it("includes 'threePointFieldGoalsMade' alias", () => {
      expect(commonMappings.threept).toContain("threePointFieldGoalsMade");
    });

    it("includes '3PT' alias", () => {
      expect(commonMappings.threept).toContain("3PT");
    });

    it("includes split 'threePointFieldGoalsMade-threePointFieldGoalsAttempted' alias", () => {
      expect(commonMappings.threept).toContain(
        "threePointFieldGoalsMade-threePointFieldGoalsAttempted"
      );
    });
  });

  describe("ft (free throws)", () => {
    it("includes 'freeThrowPercentage' alias", () => {
      expect(commonMappings.ft).toContain("freeThrowPercentage");
    });

    it("includes split 'freeThrowsMade-freeThrowsAttempted' alias", () => {
      expect(commonMappings.ft).toContain("freeThrowsMade-freeThrowsAttempted");
    });
  });

  describe("minutes", () => {
    it("includes 'minutes' alias", () => {
      expect(commonMappings.minutes).toContain("minutes");
    });

    it("includes 'toi' alias (NHL time-on-ice)", () => {
      expect(commonMappings.minutes).toContain("toi");
    });

    it("includes 'MIN' alias", () => {
      expect(commonMappings.minutes).toContain("MIN");
    });
  });

  describe("td (touchdowns)", () => {
    it("includes 'touchdowns' alias", () => {
      expect(commonMappings.td).toContain("touchdowns");
    });
  });

  describe("turnovers", () => {
    it("includes 'giveaways' alias (hockey term)", () => {
      expect(commonMappings.turnovers).toContain("giveaways");
    });

    it("includes 'TO' alias", () => {
      expect(commonMappings.turnovers).toContain("TO");
    });
  });

  describe("plusminus", () => {
    it("includes '+/-' alias", () => {
      expect(commonMappings.plusminus).toContain("+/-");
    });

    it("includes 'plus_minus' alias", () => {
      expect(commonMappings.plusminus).toContain("plus_minus");
    });
  });
});
