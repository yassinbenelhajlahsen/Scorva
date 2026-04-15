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

const mockLakers = { id: 17, name: "Los Angeles Lakers", shortname: "Lakers" };
const mockTeamList = [
  mockLakers,
  { id: 2, name: "Golden State Warriors", shortname: "Warriors" },
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
