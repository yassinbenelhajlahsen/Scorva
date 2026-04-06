import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getLeagueGames, getGameDates, getWinProbability } = await import("../../api/games.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue([]);
});

describe("getGameDates", () => {
  it("calls apiFetch with the correct path for a league", async () => {
    await getGameDates("nba");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/dates",
      expect.any(Object)
    );
  });

  it("passes season param when provided", async () => {
    await getGameDates("nba", { season: "2024-25" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/dates",
      expect.objectContaining({ params: expect.objectContaining({ season: "2024-25" }) })
    );
  });

  it("passes undefined season when not provided", async () => {
    await getGameDates("nba");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/dates",
      expect.objectContaining({ params: expect.objectContaining({ season: undefined }) })
    );
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getGameDates("nba", { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/dates",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns the resolved value from apiFetch", async () => {
    apiFetch.mockResolvedValue(["2025-01-15", "2025-01-16"]);
    const result = await getGameDates("nba");
    expect(result).toEqual(["2025-01-15", "2025-01-16"]);
  });
});

describe("getLeagueGames", () => {
  it("calls apiFetch with the correct league path", async () => {
    await getLeagueGames("nba");
    expect(apiFetch).toHaveBeenCalledWith("/api/nba/games", expect.any(Object));
  });

  it("passes date param when provided", async () => {
    await getLeagueGames("nba", { date: "2025-01-15" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games",
      expect.objectContaining({ params: expect.objectContaining({ date: "2025-01-15" }) })
    );
  });

  it("passes season param when provided", async () => {
    await getLeagueGames("nba", { season: "2024-25" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games",
      expect.objectContaining({ params: expect.objectContaining({ season: "2024-25" }) })
    );
  });

  it("passes both date and season when both are provided", async () => {
    await getLeagueGames("nba", { date: "2025-01-15", season: "2024-25" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games",
      expect.objectContaining({
        params: expect.objectContaining({ date: "2025-01-15", season: "2024-25" }),
      })
    );
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getLeagueGames("nba", { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns the date-shaped response from the backend", async () => {
    const shaped = { games: [{ id: 1 }], resolvedDate: "2025-01-15", resolvedSeason: "2024-25" };
    apiFetch.mockResolvedValue(shaped);
    const result = await getLeagueGames("nba", { date: "2025-01-15" });
    expect(result).toEqual(shaped);
  });
});

describe("getWinProbability", () => {
  it("calls apiFetch with the correct path", async () => {
    await getWinProbability("nba", "401585757");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/401585757/win-probability",
      expect.any(Object)
    );
  });

  it("passes ?final=true when isFinal is true", async () => {
    await getWinProbability("nba", "401585757", { isFinal: true });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/401585757/win-probability",
      expect.objectContaining({ params: { final: "true" } })
    );
  });

  it("does not pass ?final param when isFinal is false", async () => {
    await getWinProbability("nba", "401585757", { isFinal: false });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/401585757/win-probability",
      expect.objectContaining({ params: undefined })
    );
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getWinProbability("nba", "401585757", { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/401585757/win-probability",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns the response from apiFetch", async () => {
    const mockData = { data: [{ homeWinPercentage: 0.65, secondsLeft: 1440 }] };
    apiFetch.mockResolvedValue(mockData);
    const result = await getWinProbability("nfl", "401671773", { isFinal: true });
    expect(result).toEqual(mockData);
  });
});
