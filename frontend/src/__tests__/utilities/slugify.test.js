import { describe, it, expect } from "vitest";
import slugify from "../../utilities/slugify.js";

describe("slugify", () => {
  it("lowercases and joins with hyphens", () => {
    expect(slugify("LeBron James")).toBe("lebron-james");
  });

  it("trims leading/trailing whitespace", () => {
    expect(slugify("  Boston Celtics  ")).toBe("boston-celtics");
  });

  it("collapses multiple spaces", () => {
    expect(slugify("Los   Angeles  Lakers")).toBe("los-angeles-lakers");
  });

  it("removes special characters", () => {
    // apostrophes and ! are stripped; & surrounded by spaces collapses to single hyphen
    expect(slugify("O'Reilly & Associates!")).toBe("oreilly-associates");
  });

  it("handles already lowercase single word", () => {
    expect(slugify("nba")).toBe("nba");
  });

  it("handles existing hyphens", () => {
    expect(slugify("three-point line")).toBe("three-point-line");
  });
});
