import {
  gradeFromRaw,
  baseValue,
  wpaContribution,
  clampPlayValue,
} from "../../../src/services/games/ratingEngine.js";

describe("gradeFromRaw", () => {
  test("null raw → null", () => {
    expect(gradeFromRaw(null)).toBeNull();
    expect(gradeFromRaw(undefined)).toBeNull();
  });
  test("0 → 0.0", () => { expect(gradeFromRaw(0)).toBe(0); });
  test("negative raw floors at 0", () => { expect(gradeFromRaw(-3.1)).toBe(0); });
  test("raw 5.5 → 1.0", () => { expect(gradeFromRaw(5.5)).toBe(1); });
  test("raw 27.5 → 5.0", () => { expect(gradeFromRaw(27.5)).toBe(5); });
  test("raw 47.3 → ~8.6", () => {
    expect(gradeFromRaw(47.3)).toBeCloseTo(8.6, 1);
  });
  test("raw above ~55 caps at 10.0", () => {
    expect(gradeFromRaw(60)).toBe(10);
    expect(gradeFromRaw(1000)).toBe(10);
  });
});

describe("baseValue — NBA", () => {
  test("made 3pt at 24ft", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 24 }))
      .toBeCloseTo(1.5 + 0.02, 2);  // distance bonus = 0.02 × max(0, 24-23) = 0.02
  });
  test("made 3pt at 30ft", () => {
    // 1.5 + 0.02 × 7 = 1.64
    expect(baseValue("scorer", { type: "made_3pt", distance: 30 })).toBeCloseTo(1.64, 2);
  });
  test("made 3pt at >>23ft caps at 3.0", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 100 })).toBe(3.0);
  });
  test("made 2pt at 8ft", () => {
    expect(baseValue("scorer", { type: "made_2pt", distance: 8 })).toBeCloseTo(1.16, 2);
  });
  test("made 2pt caps at 2.0", () => {
    expect(baseValue("scorer", { type: "made_2pt", distance: 100 })).toBe(2.0);
  });
  test("made FT", () => { expect(baseValue("scorer", { type: "made_ft" })).toBe(0.4); });
  test("missed shot", () => { expect(baseValue("shot_attempter", { type: "missed_3pt" })).toBe(-0.5); });
  test("missed FT", () => { expect(baseValue("shot_attempter", { type: "missed_ft" })).toBe(-0.3); });
  test("assister", () => { expect(baseValue("assister", {})).toBe(0.7); });
  test("offensive rebound", () => { expect(baseValue("rebounder", { offensive: true })).toBe(0.6); });
  test("defensive rebound", () => { expect(baseValue("rebounder", { offensive: false })).toBe(0.3); });
  test("steal", () => { expect(baseValue("stealer", {})).toBe(1.0); });
  test("block", () => { expect(baseValue("blocker", {})).toBe(0.7); });
  test("turnover", () => { expect(baseValue("turnover_committer", {})).toBe(-1.0); });
  test("shooting foul", () => { expect(baseValue("foul_committer", { shooting: true })).toBe(-0.5); });
  test("non-shooting foul", () => { expect(baseValue("foul_committer", { shooting: false })).toBe(-0.2); });
  test("unknown role → 0", () => { expect(baseValue("mystery", {})).toBe(0); });
});

describe("wpaContribution", () => {
  test("home participant on positive WPA shift", () => {
    expect(wpaContribution(0.05, "home")).toBeCloseTo(1.5, 5);
  });
  test("home participant on negative WPA shift (turnover, etc.)", () => {
    expect(wpaContribution(-0.05, "home")).toBeCloseTo(-1.5, 5);
  });
  test("away participant — sign flips", () => {
    expect(wpaContribution(0.05, "away")).toBeCloseTo(-1.5, 5);
    expect(wpaContribution(-0.05, "away")).toBeCloseTo(1.5, 5);
  });
  test("null wpa_delta returns 0", () => {
    expect(wpaContribution(null, "home")).toBe(0);
  });
  test("clutch shift of +0.30 from home → +9", () => {
    expect(wpaContribution(0.30, "home")).toBeCloseTo(9.0, 5);
  });
});

describe("clampPlayValue", () => {
  test("normal range passes through", () => { expect(clampPlayValue(2.3)).toBe(2.3); });
  test("clamps to +10", () => { expect(clampPlayValue(20)).toBe(10); });
  test("clamps to -10", () => { expect(clampPlayValue(-25)).toBe(-10); });
});
