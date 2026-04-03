import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getLeagueGames, getGameDates } = await import("../../api/games.js");

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
