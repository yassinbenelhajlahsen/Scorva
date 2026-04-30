import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPoolQuery = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../../src/db/db.js"), () => ({
  default: { query: mockPoolQuery },
}));

const { getInjuriesForLeague } = await import(
  resolve(__dirname, "../../../src/services/reports/injuriesReports.js")
);

describe("getInjuriesForLeague", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns injury reports shaped by the spec", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{
        history_id: "12345",
        changed_at: new Date("2026-04-30T18:00:00Z"),
        player_id: 4234,
        player_name: "Bones Hyland",
        player_image: "https://espn.com/x.png",
        prev_status: "questionable",
        new_status: "active",
        new_status_description: null,
      }],
    });

    const out = await getInjuriesForLeague("nba");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "injury-12345",
      type: "injury",
      league: "nba",
      prevStatus: "questionable",
      newStatus: "active",
      newStatusDescription: null,
      player: { id: 4234, name: "Bones Hyland", slug: "bones-hyland", imageUrl: "https://espn.com/x.png", league: "nba" },
    });
    expect(typeof out[0].date).toBe("string");
  });

  it("limits to last 30 days via SQL parameter", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    await getInjuriesForLeague("nba");
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(/changed_at\s*>\s*NOW\(\)\s*-\s*INTERVAL\s*'30 days'/i);
    expect(params).toEqual(["nba"]);
  });

  it("returns [] when DB query fails", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("db down"));
    const out = await getInjuriesForLeague("nba");
    expect(out).toEqual([]);
  });
});
