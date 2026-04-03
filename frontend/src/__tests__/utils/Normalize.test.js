import { describe, it, expect } from "vitest";
import normalize from "../../utils/normalize.js";

describe("normalize", () => {
  it("lowercases and strips non-alpha characters", () => {
    expect(normalize("LeBron James")).toBe("lebronjames");
  });

  it("removes numbers", () => {
    expect(normalize("Team23")).toBe("team");
  });

  it("removes spaces", () => {
    expect(normalize("Los Angeles")).toBe("losangeles");
  });

  it("removes punctuation", () => {
    expect(normalize("O'Brien")).toBe("obrien");
  });

  it("returns undefined for undefined input", () => {
    expect(normalize(undefined)).toBe(undefined);
  });

  it("returns empty string for empty string", () => {
    expect(normalize("")).toBe("");
  });
});
