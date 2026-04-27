import { describe, it, expect } from "@jest/globals";
import { parseSearchTerm } from "../../src/services/meta/searchParser.js";

describe("parseSearchTerm", () => {
  describe("empty inputs", () => {
    it("returns empty for blank string", () => {
      expect(parseSearchTerm("")).toEqual({ kind: "empty" });
    });

    it("returns empty for whitespace only", () => {
      expect(parseSearchTerm("   ")).toEqual({ kind: "empty" });
    });

    it("returns empty for term longer than 200 chars", () => {
      expect(parseSearchTerm("a".repeat(201))).toEqual({ kind: "empty" });
    });

    it("accepts term exactly 200 chars", () => {
      const term = "a".repeat(200);
      expect(parseSearchTerm(term)).toEqual({ kind: "single", token: term });
    });
  });

  describe("single token", () => {
    it("returns single for one word", () => {
      expect(parseSearchTerm("lakers")).toEqual({
        kind: "single",
        token: "lakers",
      });
    });

    it("trims surrounding whitespace", () => {
      expect(parseSearchTerm("  lakers  ")).toEqual({
        kind: "single",
        token: "lakers",
      });
    });

    it("collapses internal whitespace", () => {
      expect(parseSearchTerm("Los   Angeles")).toEqual({
        kind: "single",
        token: "Los Angeles",
      });
    });

    it("preserves original case", () => {
      expect(parseSearchTerm("LeBron")).toEqual({
        kind: "single",
        token: "LeBron",
      });
    });
  });

  describe("matchup separators", () => {
    it("splits on ' vs '", () => {
      expect(parseSearchTerm("rockets vs lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' vs. '", () => {
      expect(parseSearchTerm("rockets vs. lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' v '", () => {
      expect(parseSearchTerm("rockets v lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' @ '", () => {
      expect(parseSearchTerm("rockets @ lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' at '", () => {
      expect(parseSearchTerm("rockets at lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' - '", () => {
      expect(parseSearchTerm("rockets - lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("does NOT split hyphens within a word", () => {
      expect(parseSearchTerm("Mike Smith-Pelly")).toEqual({
        kind: "single",
        token: "Mike Smith-Pelly",
      });
    });

    it("is case-insensitive on the separator", () => {
      expect(parseSearchTerm("rockets VS lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });
  });

  describe("partial input", () => {
    it("trailing 'vs' degrades to single token (lhs)", () => {
      expect(parseSearchTerm("lakers vs ")).toEqual({
        kind: "single",
        token: "lakers",
      });
    });

    it("leading 'vs' degrades to single token (rhs)", () => {
      expect(parseSearchTerm(" vs lakers")).toEqual({
        kind: "single",
        token: "lakers",
      });
    });

    it("only-separator string returns empty", () => {
      expect(parseSearchTerm(" vs ")).toEqual({ kind: "empty" });
    });
  });

  describe("multiple separators", () => {
    it("splits on the first separator only", () => {
      expect(parseSearchTerm("rockets vs lakers vs heat")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers vs heat",
      });
    });
  });
});
