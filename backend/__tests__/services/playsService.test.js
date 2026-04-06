import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn, _opts) => fn());
const mockAxiosGet = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

jest.unstable_mockModule("axios", () => ({ default: { get: mockAxiosGet } }));

const { getPlays } = await import(resolve(__dirname, "../../src/services/playsService.js"));

const THIRTY_DAYS = 30 * 86400;

function makeGameRow(overrides = {}) {
  return { eventid: 401584583, status: "Final", ...overrides };
}

function makePlayRow(overrides = {}) {
  return {
    id: 1,
    espn_play_id: "100",
    sequence: 1,
    period: 1,
    clock: "12:00",
    description: "LeBron James makes 2-pt shot",
    short_text: "LeBron 2pt",
    home_score: 2,
    away_score: 0,
    scoring_play: true,
    team_id: 1,
    play_type: "Made Shot",
    drive_number: null,
    drive_description: null,
    drive_result: null,
    team_logo: "https://espn.com/lal.png",
    team_short: "LAL",
    ...overrides,
  };
}

describe("playsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn, _opts) => fn());
  });

  describe("getPlays — game not found", () => {
    it("returns null when game does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getPlays(999, "nba");

      expect(result).toBeNull();
    });
  });

  describe("getPlays — Final game (DB path)", () => {
    it("calls cached with correct key and 30-day TTL", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeGameRow()] })  // game lookup
        .mockResolvedValueOnce({ rows: [makePlayRow()] }); // plays query

      await getPlays(1, "nba");

      expect(mockCached).toHaveBeenCalledWith(
        "plays:nba:1",
        THIRTY_DAYS,
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("queries plays table with ORDER BY sequence", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeGameRow()] })
        .mockResolvedValueOnce({ rows: [makePlayRow()] });

      await getPlays(1, "nba");

      const playsQuery = mockPool.query.mock.calls[1];
      expect(playsQuery[0]).toContain("FROM plays p");
      expect(playsQuery[0]).toContain("ORDER BY p.sequence ASC");
      expect(playsQuery[1]).toEqual([1]);
    });

    it("returns plays array with source db", async () => {
      const play = makePlayRow();
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeGameRow()] })
        .mockResolvedValueOnce({ rows: [play] });

      const result = await getPlays(1, "nba");

      expect(result).toEqual({ plays: [play], source: "db" });
    });

    it("returns null from cached query when no plays in DB", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeGameRow()] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getPlays(1, "nba");

      expect(result).toBeNull();
    });

    it("cacheIf returns true when result is non-null", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeGameRow()] })
        .mockResolvedValueOnce({ rows: [makePlayRow()] });

      await getPlays(1, "nba");

      const [, , , opts] = mockCached.mock.calls[0];
      expect(opts.cacheIf({ plays: [makePlayRow()], source: "db" })).toBe(true);
    });

    it("cacheIf returns falsy when result is null", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeGameRow()] })
        .mockResolvedValueOnce({ rows: [] });

      await getPlays(1, "nba");

      const [, , , opts] = mockCached.mock.calls[0];
      expect(opts.cacheIf(null)).toBeFalsy();
    });

    it("does not call ESPN for Final games", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeGameRow()] })
        .mockResolvedValueOnce({ rows: [makePlayRow()] });

      await getPlays(1, "nba");

      expect(mockAxiosGet).not.toHaveBeenCalled();
    });
  });

  describe("getPlays — live game (ESPN path)", () => {
    it("calls ESPN playbyplay endpoint for In Progress games", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [makeGameRow({ status: "In Progress" })],
      });

      mockAxiosGet.mockResolvedValueOnce({
        data: { plays: [] },
      });

      await getPlays(1, "nba");

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining("playbyplay?event=401584583"),
        expect.any(Object),
      );
    });

    it("normalizes NBA live plays from ESPN response", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [makeGameRow({ status: "In Progress" })],
      });

      mockAxiosGet.mockResolvedValueOnce({
        data: {
          plays: [
            {
              id: "50",
              sequenceNumber: "5",
              period: { number: 2 },
              clock: { displayValue: "8:30" },
              text: "Curry makes 3pt",
              shortText: "Curry 3pt",
              homeScore: 40,
              awayScore: 38,
              scoringPlay: true,
              team: { id: "9" },
              type: { text: "Made Three Point Shot" },
            },
          ],
        },
      });

      const result = await getPlays(1, "nba");

      expect(result.source).toBe("espn");
      expect(result.plays).toHaveLength(1);
      expect(result.plays[0]).toMatchObject({
        espn_play_id: "50",
        sequence: 5,
        period: 2,
        clock: "8:30",
        description: "Curry makes 3pt",
        home_score: 40,
        scoring_play: true,
        play_type: "Made Three Point Shot",
      });
    });

    it("normalizes NFL drives from ESPN response", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [makeGameRow({ status: "In Progress" })],
      });

      mockAxiosGet.mockResolvedValueOnce({
        data: {
          drives: {
            previous: [
              {
                description: "10 plays, 60 yards",
                result: "Field Goal",
                plays: [
                  {
                    id: "300",
                    sequenceNumber: "1",
                    period: { number: 1 },
                    clock: { displayValue: "10:00" },
                    text: "Mahomes pass incomplete",
                    shortText: "Incomplete",
                    homeScore: 0,
                    awayScore: 0,
                    scoringPlay: false,
                    team: { id: "9" },
                    type: { text: "Pass" },
                  },
                ],
              },
            ],
          },
        },
      });

      const result = await getPlays(1, "nfl");

      expect(result.source).toBe("espn");
      expect(result.plays[0]).toMatchObject({
        drive_number: 1,
        drive_description: "10 plays, 60 yards",
        drive_result: "Field Goal",
        description: "Mahomes pass incomplete",
      });
    });

    it("returns empty plays and source espn_error when ESPN call fails", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [makeGameRow({ status: "In Progress" })],
      });
      mockAxiosGet.mockRejectedValueOnce(new Error("ESPN timeout"));

      const result = await getPlays(1, "nba");

      expect(result).toEqual({ plays: [], source: "espn_error" });
    });

    it("does not use cache for live games", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [makeGameRow({ status: "In Progress" })],
      });
      mockAxiosGet.mockResolvedValueOnce({ data: { plays: [] } });

      await getPlays(1, "nba");

      expect(mockCached).not.toHaveBeenCalled();
    });
  });

  describe("getPlays — scheduled game (no eventid)", () => {
    it("returns empty plays when game has no eventid", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [makeGameRow({ status: "Scheduled", eventid: null })],
      });

      const result = await getPlays(1, "nba");

      expect(result).toEqual({ plays: [], source: "none" });
      expect(mockAxiosGet).not.toHaveBeenCalled();
    });
  });
});
