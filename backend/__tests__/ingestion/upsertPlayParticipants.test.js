import { jest } from "@jest/globals";
import upsertPlayParticipants from "../../src/ingestion/upsert/upsertPlayParticipants.js";

const summaryData = {
  plays: [
    {
      id: "1", sequenceNumber: "1", type: { text: "Jump Shot" },
      text: "Wade makes 24-foot three (Mobley assists)",
      scoringPlay: true, shootingPlay: true,
      participants: [{ athlete: { id: "3912848" } }, { athlete: { id: "4432158" } }],
    },
    {
      id: "2", sequenceNumber: "2", type: { text: "Defensive Rebound" },
      text: "Harris defensive rebound",
      participants: [{ athlete: { id: "6440" } }],
    },
    {
      id: "3", sequenceNumber: "3", type: { text: "Substitution" },
      text: "sub", participants: [{ athlete: { id: "999" } }],
    },
  ],
};

test("noop on non-NBA league", async () => {
  const client = { query: jest.fn() };
  await upsertPlayParticipants(client, 100, summaryData, "nfl");
  expect(client.query).not.toHaveBeenCalled();
});

test("resolves athlete IDs and bulk-inserts participants for rated plays only", async () => {
  // Stage 1: lookup of espn_athlete_id -> player.id
  // Stage 2: lookup of (sequence -> play.id)
  // Stage 3: DELETE existing participants for this game
  // Stage 4: INSERT new participants
  const client = {
    query: jest.fn()
      // 1. SELECT id, espn_playerid FROM players ...
      .mockResolvedValueOnce({ rows: [
        { id: 11, espn_playerid: 3912848 },
        { id: 12, espn_playerid: 4432158 },
        { id: 13, espn_playerid: 6440 },
      ]})
      // 2. SELECT id, sequence FROM plays WHERE gameid = ...
      .mockResolvedValueOnce({ rows: [
        { id: 501, sequence: 1 },
        { id: 502, sequence: 2 },
        { id: 503, sequence: 3 },
      ]})
      // 3. DELETE
      .mockResolvedValueOnce({ rowCount: 0 })
      // 4. INSERT
      .mockResolvedValueOnce({ rowCount: 3 }),
  };

  await upsertPlayParticipants(client, 100, summaryData, "nba");

  // Verify the SQL pattern of each call
  expect(client.query.mock.calls[0][0]).toMatch(/SELECT id, espn_playerid FROM players/);
  expect(client.query.mock.calls[1][0]).toMatch(/SELECT id, sequence FROM plays WHERE gameid/);
  expect(client.query.mock.calls[2][0]).toMatch(/DELETE FROM play_participants/);
  expect(client.query.mock.calls[3][0]).toMatch(/INSERT INTO play_participants/);

  // INSERT receives 3 participant rows (scorer, assister, rebounder) — not the substitution
  const insertArgs = client.query.mock.calls[3][1];
  // Args are 4 parallel arrays: [play_ids, player_ids, roles, espn_athlete_ids]
  expect(insertArgs[0]).toEqual([501, 501, 502]);
  expect(insertArgs[1]).toEqual([11, 12, 13]);
  expect(insertArgs[2]).toEqual(["scorer", "assister", "rebounder"]);
  expect(insertArgs[3]).toEqual(["3912848", "4432158", "6440"]);
});

test("skips participants whose athlete ID can't be resolved to a local player", async () => {
  const client = {
    query: jest.fn()
      // Only Wade and Harris are known; Mobley is missing
      .mockResolvedValueOnce({ rows: [
        { id: 11, espn_playerid: 3912848 },
        { id: 13, espn_playerid: 6440 },
      ]})
      .mockResolvedValueOnce({ rows: [
        { id: 501, sequence: 1 },
        { id: 502, sequence: 2 },
        { id: 503, sequence: 3 },
      ]})
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 2 }),
  };

  await upsertPlayParticipants(client, 100, summaryData, "nba");
  const insertArgs = client.query.mock.calls[3][1];
  expect(insertArgs[0]).toEqual([501, 502]);
  expect(insertArgs[1]).toEqual([11, 13]);
  expect(insertArgs[2]).toEqual(["scorer", "rebounder"]);
});

test("skips DELETE+INSERT if there are no rated participants", async () => {
  const client = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [] })  // no players resolved
      .mockResolvedValueOnce({ rows: [] }), // doesn't matter
  };
  const empty = { plays: [{ type: { text: "Substitution" }, participants: [{ athlete: { id: "1" } }] }] };
  await upsertPlayParticipants(client, 100, empty, "nba");
  // Should issue at most the player-lookup query, then no further writes
  expect(client.query.mock.calls.length).toBeLessThanOrEqual(2);
});
