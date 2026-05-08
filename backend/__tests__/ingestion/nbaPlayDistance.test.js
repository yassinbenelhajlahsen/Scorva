import { extractShotDistance } from "../../src/ingestion/mappings/nbaPlayDistance.js";

describe("extractShotDistance", () => {
  test("returns null for non-shooting plays", () => {
    expect(extractShotDistance({ shootingPlay: false, coordinate: { x: 5, y: 5 } })).toBeNull();
  });

  test("returns null for free throws", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "Stephen Curry makes free throw 1 of 2",
      coordinate: { x: -2147483340, y: -2147483365 },
    })).toBeNull();
  });

  test("computes ~24ft for a 3pt at coordinate (1, 4)", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "Dean Wade makes 24-foot three point jumper",
      coordinate: { x: 1, y: 4 },
    })).toBe(24);
  });

  test("computes ~8ft for a floater at coordinate (24, 8)", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "Jarrett Allen misses 7-foot floating jump shot",
      coordinate: { x: 24, y: 8 },
    })).toBe(8);
  });

  test("returns null when coordinate sentinel indicates missing data", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "Made layup",
      coordinate: { x: -2147483340, y: -2147483365 },
    })).toBeNull();
  });

  test("returns null when coordinate missing entirely", () => {
    expect(extractShotDistance({ shootingPlay: true, text: "Made layup" })).toBeNull();
  });

  test("returns null for nonsensical distances (>89ft)", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "halfcourt",
      coordinate: { x: -100, y: 50 },
    })).toBeNull();
  });

  test("returns null for distance of 0 (right at basket — likely bad data)", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "tip",
      coordinate: { x: 25, y: 0 },
    })).toBeNull();
  });
});
