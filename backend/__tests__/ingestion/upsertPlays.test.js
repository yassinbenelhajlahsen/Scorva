import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import upsertPlays from "../../src/ingestion/upsertPlays.js";

function makeMockClient() {
  return { query: jest.fn().mockResolvedValue({ rows: [] }) };
}

// Shared team IDs
const HOME_TEAM_ID = 1;
const AWAY_TEAM_ID = 2;
const HOME_ESPN_ID = 13;
const AWAY_ESPN_ID = 17;

// ─── NBA/NHL summary data helpers ─────────────────────────────────────────────

function makePlay(overrides = {}) {
  return {
    id: "100",
    sequenceNumber: "1",
    period: { number: 1 },
    clock: { displayValue: "12:00" },
    text: "LeBron James makes 2-pt shot",
    shortText: "LeBron 2pt",
    homeScore: 2,
    awayScore: 0,
    scoringPlay: true,
    team: { id: String(HOME_ESPN_ID) },
    type: { text: "Made Shot" },
    ...overrides,
  };
}

function makeNbaData(plays = [makePlay()]) {
  return { plays };
}

// ─── NFL summary data helpers ─────────────────────────────────────────────────

function makeNflPlay(overrides = {}) {
  return {
    id: "200",
    sequenceNumber: "1",
    period: { number: 1 },
    clock: { displayValue: "15:00" },
    text: "Patrick Mahomes pass to Travis Kelce for 15 yards",
    shortText: "Mahomes to Kelce 15 yds",
    homeScore: 0,
    awayScore: 0,
    scoringPlay: false,
    team: { id: String(HOME_ESPN_ID) },
    type: { text: "Pass" },
    ...overrides,
  };
}

function makeNflDrive(plays = [makeNflPlay()], overrides = {}) {
  return {
    description: "13 plays, 75 yards",
    result: "Touchdown",
    plays,
    ...overrides,
  };
}

function makeNflData(previous = [makeNflDrive()], current = null) {
  return { drives: { previous, current } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("upsertPlays", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = makeMockClient();
  });

  describe("NBA/NHL plays", () => {
    it("calls INSERT with correct parameter count", async () => {
      await upsertPlays(
        mockClient,
        42,
        makeNbaData(),
        "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID,
      );

      expect(mockClient.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockClient.query.mock.calls[0];
      expect(sql).toContain("INSERT INTO plays");
      expect(sql).toContain("ON CONFLICT (gameid, sequence) DO UPDATE");
      expect(params[0]).toBe(42); // gameId
      expect(params.length).toBe(15); // gameId + 14 unnest arrays
    });

    it("passes correct play fields", async () => {
      const play = makePlay();
      await upsertPlays(mockClient, 1, makeNbaData([play]), "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      const espnPlayIds   = params[1];
      const sequences     = params[2];
      const periods       = params[3];
      const clocks        = params[4];
      const descriptions  = params[5];
      const shortTexts    = params[6];
      const homeScores    = params[7];
      const awayScores    = params[8];
      const scoringPlays  = params[9];
      const teamIds       = params[10];

      expect(espnPlayIds[0]).toBe("100");
      expect(sequences[0]).toBe(1);
      expect(periods[0]).toBe(1);
      expect(clocks[0]).toBe("12:00");
      expect(descriptions[0]).toBe("LeBron James makes 2-pt shot");
      expect(shortTexts[0]).toBe("LeBron 2pt");
      expect(homeScores[0]).toBe(2);
      expect(awayScores[0]).toBe(0);
      expect(scoringPlays[0]).toBe(true);
      expect(teamIds[0]).toBe(HOME_TEAM_ID);
    });

    it("resolves away team_id correctly", async () => {
      const play = makePlay({ team: { id: String(AWAY_ESPN_ID) }, scoringPlay: false });
      await upsertPlays(mockClient, 1, makeNbaData([play]), "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[10][0]).toBe(AWAY_TEAM_ID);
    });

    it("sets team_id to null for unknown ESPN team", async () => {
      const play = makePlay({ team: { id: "999" } });
      await upsertPlays(mockClient, 1, makeNbaData([play]), "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[10][0]).toBeNull();
    });

    it("sets drive_* columns to null for NBA plays", async () => {
      await upsertPlays(mockClient, 1, makeNbaData(), "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[12][0]).toBeNull(); // drive_number
      expect(params[13][0]).toBeNull(); // drive_description
      expect(params[14][0]).toBeNull(); // drive_result
    });

    it("handles multiple plays", async () => {
      const plays = [
        makePlay({ sequenceNumber: "1", text: "Play 1" }),
        makePlay({ sequenceNumber: "2", text: "Play 2", scoringPlay: false }),
      ];
      await upsertPlays(mockClient, 1, makeNbaData(plays), "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[2].length).toBe(2);
      expect(params[5]).toEqual(["Play 1", "Play 2"]);
    });

    it("does nothing when plays array is empty", async () => {
      await upsertPlays(mockClient, 1, { plays: [] }, "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it("does nothing when plays key is missing", async () => {
      await upsertPlays(mockClient, 1, {}, "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it("filters out plays with missing description", async () => {
      const plays = [
        makePlay({ text: "", shortText: "" }),
        makePlay({ sequenceNumber: "2", text: "Valid play" }),
      ];
      await upsertPlays(mockClient, 1, makeNbaData(plays), "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[2].length).toBe(1);
      expect(params[5][0]).toBe("Valid play");
    });

    it("handles null homeScore/awayScore gracefully", async () => {
      const play = makePlay({ homeScore: null, awayScore: undefined });
      await upsertPlays(mockClient, 1, makeNbaData([play]), "nba",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[7][0]).toBeNull();
      expect(params[8][0]).toBeNull();
    });
  });

  describe("NFL drives", () => {
    it("flattens drive plays with drive metadata", async () => {
      await upsertPlays(mockClient, 5, makeNflData(), "nfl",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      expect(mockClient.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockClient.query.mock.calls[0];
      expect(sql).toContain("INSERT INTO plays");
      expect(params[12][0]).toBe(1);                    // drive_number
      expect(params[13][0]).toBe("13 plays, 75 yards"); // drive_description
      expect(params[14][0]).toBe("Touchdown");           // drive_result
    });

    it("assigns sequential drive numbers across multiple drives", async () => {
      const data = makeNflData([
        makeNflDrive([makeNflPlay({ sequenceNumber: "1" })], { description: "Drive 1", result: "Punt" }),
        makeNflDrive([makeNflPlay({ sequenceNumber: "2" })], { description: "Drive 2", result: "Touchdown" }),
      ]);

      await upsertPlays(mockClient, 5, data, "nfl",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[12]).toEqual([1, 2]);
      expect(params[14]).toEqual(["Punt", "Touchdown"]);
    });

    it("includes current drive when present", async () => {
      const data = makeNflData(
        [makeNflDrive([makeNflPlay({ sequenceNumber: "1" })], { description: "D1", result: "Punt" })],
        makeNflDrive([makeNflPlay({ sequenceNumber: "2" })], { description: "D2 current", result: null }),
      );

      await upsertPlays(mockClient, 5, data, "nfl",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[2].length).toBe(2);
      expect(params[13]).toEqual(["D1", "D2 current"]);
    });

    it("does nothing when drives object is missing", async () => {
      await upsertPlays(mockClient, 5, {}, "nfl",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it("resolves team from drive when play has no team", async () => {
      const play = makeNflPlay({ team: undefined });
      const drive = makeNflDrive([play]);
      drive.team = { id: String(AWAY_ESPN_ID) };

      await upsertPlays(mockClient, 5, makeNflData([drive]), "nfl",
        HOME_TEAM_ID, AWAY_TEAM_ID, HOME_ESPN_ID, AWAY_ESPN_ID);

      const [, params] = mockClient.query.mock.calls[0];
      expect(params[10][0]).toBe(AWAY_TEAM_ID);
    });
  });
});
