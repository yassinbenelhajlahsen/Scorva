import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockAxiosGet = jest.fn();
jest.unstable_mockModule("axios", () => ({
  default: { get: mockAxiosGet },
}));

const mockPoolQuery = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../../src/db/db.js"), () => ({
  default: { query: mockPoolQuery },
}));

const { getMovesForLeague } = await import(
  resolve(__dirname, "../../../src/services/reports/movesReports.js")
);

const TEAM = {
  id: "17",
  abbreviation: "BKN",
  displayName: "Brooklyn Nets",
  logos: [{ href: "https://espn.com/bkn.png" }],
};

describe("getMovesForLeague", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns parsed moves with resolved players and teams", async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        transactions: [
          { date: "2026-04-12T07:00Z", description: "Signed F Trevon Scott to a 10-day contract.", team: TEAM },
        ],
      },
    });
    // teams lookup
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 17, espnid: 17, abbreviation: "BKN", name: "Brooklyn Nets", logo_url: "x.png" }],
    });
    // players lookup for nba
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 4234, name: "Trevon Scott", slug: "trevon-scott", image_url: "y.png" }],
    });

    const moves = await getMovesForLeague("nba");

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      type: "move",
      league: "nba",
      action: "sign",
      fromTeam: null,
      toTeam: { id: 17, abbreviation: "BKN", name: "Brooklyn Nets", logoUrl: "x.png" },
      player: { id: 4234, name: "Trevon Scott", slug: "trevon-scott", imageUrl: "y.png", league: "nba" },
    });
  });

  it("filters AHL-only moves", async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        transactions: [
          { date: "2026-04-12T07:00Z", description: "Assigned G X to Wilkes-Barre (AHL).", team: TEAM },
        ],
      },
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const moves = await getMovesForLeague("nhl");
    expect(moves).toEqual([]);
  });

  it("returns [] when ESPN fetch fails", async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error("ESPN down"));

    const moves = await getMovesForLeague("nba");
    expect(moves).toEqual([]);
  });

  it("emits one move per resolved player from a multi-player description", async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        transactions: [{
          date: "2026-04-12T07:00Z",
          description: "Signed F Trevon Scott and F Dalano Banton to 10-day contracts.",
          team: TEAM,
        }],
      },
    });
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 17, espnid: 17, abbreviation: "BKN", name: "Brooklyn Nets", logo_url: "x.png" }],
    });
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        { id: 4234, name: "Trevon Scott", slug: "trevon-scott", image_url: "a.png" },
        { id: 5003, name: "Dalano Banton", slug: "dalano-banton", image_url: "b.png" },
      ],
    });

    const moves = await getMovesForLeague("nba");
    expect(moves).toHaveLength(2);
    expect(moves.map((m) => m.player.name).sort()).toEqual(["Dalano Banton", "Trevon Scott"]);
  });
});
