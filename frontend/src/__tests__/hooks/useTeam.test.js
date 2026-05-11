// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/teams.js", () => ({
  getTeams: vi.fn(),
  getStandings: vi.fn(),
  getTeamSeasons: vi.fn(),
}));
vi.mock("../../api/games.js", () => ({ getTeamGames: vi.fn() }));
vi.mock("../../utils/slugify.js", () => ({
  default: (s) => s.toLowerCase().replace(/\s+/g, "-"),
}));

const { getTeams, getStandings, getTeamSeasons } = await import("../../api/teams.js");
const { getTeamGames } = await import("../../api/games.js");
const { useTeam } = await import("../../hooks/data/useTeam.js");

const mockLakers = { id: 17, name: "Los Angeles Lakers", shortname: "Lakers", abbreviation: "LAL" };
const mockTeamList = [
  mockLakers,
  { id: 2, name: "Golden State Warriors", shortname: "Warriors", abbreviation: "GS" },
];

const mockGames = [
  { id: 1, date: "2025-01-10", status: "Final", hometeamid: 17, awayteamid: 2, winnerid: 17, type: "regular" },
  { id: 2, date: "2025-01-05", status: "Final", hometeamid: 2, awayteamid: 17, winnerid: 17, type: "regular" },
  { id: 3, date: "2025-01-15", status: "Scheduled", hometeamid: 17, awayteamid: 2, winnerid: null, type: "regular" },
];

const mockStandings = [
  { id: 17, wins: 30, losses: 15 },
  { id: 2, wins: 25, losses: 20 },
];

const mockStandingsWithConf = [
  { id: 99, wins: 35, losses: 10, conf: "west", division: "pacific" },
  { id: 17, wins: 30, losses: 15, conf: "west", division: "pacific" },
  { id: 2, wins: 25, losses: 20, conf: "west", division: "pacific" },
  { id: 88, wins: 32, losses: 13, conf: "east", division: "atlantic" },
];

beforeEach(() => {
  vi.clearAllMocks();
  getTeamSeasons.mockResolvedValue([]);
});

describe("useTeam", () => {
  it("starts in loading state", () => {
    getTeams.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.team).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("resolves team from slug match", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.team).toEqual(mockLakers));
    expect(result.current.loading).toBe(false);
  });

  it("resolves team from lowercase abbreviation match", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "lal", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.team).toEqual(mockLakers));
  });

  it("resolves team from uppercase abbreviation in URL (case-insensitive)", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "LAL", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.team).toEqual(mockLakers));
  });

  it("falls back to shortname slug when abbreviation and name slug do not match", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.team).toEqual(mockLakers));
  });

  it("sets error when team is not found", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    const { result } = renderHook(
      () => useTeam("nba", "nonexistent-team", "2024-25"),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.error).toBe("Team not found."));
    expect(result.current.loading).toBe(false);
  });

  it("fetches games and standings after team is resolved", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    renderHook(() => useTeam("nba", "los-angeles-lakers", "2024-25"), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(getTeamGames).toHaveBeenCalledWith(
        "nba",
        17,
        expect.objectContaining({ season: "2024-25" })
      )
    );
    expect(getStandings).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ season: "2024-25" })
    );
  });

  it("computes home/away records from final games", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.homeRecord).not.toBeNull());
    expect(result.current.homeRecord).toBe("1-0");
    expect(result.current.awayRecord).toBe("1-0");
  });

  it("sets teamRecord from standings", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.teamRecord).toBe("30-15"));
  });

  it("sorts games by date descending", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.games.length).toBeGreaterThan(0));
    const dates = result.current.games.map((g) => g.date);
    expect(dates).toEqual([...dates].sort((a, b) => new Date(b) - new Date(a)));
  });

  it("sets error on teams fetch failure", async () => {
    getTeams.mockRejectedValue(new Error("API down"));
    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.error).toBe("API down"));
    expect(result.current.loading).toBe(false);
  });

  it("computes confRank and divRank from sorted standings", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandingsWithConf);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.confRank).not.toBeNull());
    expect(result.current.confRank).toBe(2);
    expect(result.current.divRank).toBe(2);
    expect(result.current.conf).toBe("west");
    expect(result.current.division).toBe("pacific");
  });

  it("returns null ranks when team has no conf/division", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.teamRecord).not.toBeNull());
    expect(result.current.confRank).toBeNull();
    expect(result.current.divRank).toBeNull();
  });

  it("computes last10 from final games only", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.last10).not.toBeNull());
    expect(result.current.last10.n).toBe(2);
    expect(result.current.last10.wins).toBe(2);
    expect(result.current.last10.losses).toBe(0);
    expect(result.current.last10.label).toBe("2-0");
  });

  it("formats NHL last10 as W-L-OTL", async () => {
    const nhlGames = [
      { id: 1, date: "2025-01-10", status: "Final", hometeamid: 17, awayteamid: 2, winnerid: 17, type: "regular" },
      { id: 2, date: "2025-01-08", status: "Final/OT", hometeamid: 17, awayteamid: 2, winnerid: 2, type: "regular" },
      { id: 3, date: "2025-01-05", status: "Final/SO", hometeamid: 2, awayteamid: 17, winnerid: 2, type: "regular" },
      { id: 4, date: "2025-01-03", status: "Final", hometeamid: 17, awayteamid: 2, winnerid: 2, type: "regular" },
    ];
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(nhlGames);
    getStandings.mockResolvedValue([{ id: 17, wins: 1, losses: 3, otl: 2 }]);

    const { result } = renderHook(
      () => useTeam("nhl", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.last10).not.toBeNull());
    expect(result.current.last10.n).toBe(4);
    expect(result.current.last10.wins).toBe(1);
    expect(result.current.last10.losses).toBe(3);
    expect(result.current.last10.otl).toBe(2);
    expect(result.current.last10.label).toBe("1-1-2");
  });

  it("excludes play-in games from last10", async () => {
    const games = [
      { id: 1, date: "2025-01-10", status: "Final", hometeamid: 17, awayteamid: 2, winnerid: 17, type: "regular", game_label: "Play-In Tournament" },
      { id: 2, date: "2025-01-05", status: "Final", hometeamid: 2, awayteamid: 17, winnerid: 17, type: "regular" },
    ];
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(games);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.last10).not.toBeNull());
    expect(result.current.last10.n).toBe(1);
  });

  it("returns last10.n=0 when team has no final games", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue([
      { id: 1, date: "2025-01-15", status: "Scheduled", hometeamid: 17, awayteamid: 2, winnerid: null, type: "regular" },
    ]);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.last10).not.toBeNull());
    expect(result.current.last10.n).toBe(0);
    expect(result.current.last10.label).toBeNull();
  });

  it("retry re-fetches teams", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.retry());
    await waitFor(() => expect(getTeams).toHaveBeenCalledTimes(2));
  });
});
