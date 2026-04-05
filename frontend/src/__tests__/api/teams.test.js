import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getTeams, getStandings } = await import("../../api/teams.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue([]);
});

describe("getTeams", () => {
  it("calls apiFetch with the correct path", async () => {
    await getTeams("nba");
    expect(apiFetch).toHaveBeenCalledWith("/api/nba/teams", expect.any(Object));
  });

  it("works with different leagues", async () => {
    await getTeams("nfl");
    expect(apiFetch).toHaveBeenCalledWith("/api/nfl/teams", expect.any(Object));
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getTeams("nba", { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/teams",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns the resolved value from apiFetch", async () => {
    const teams = [{ id: 1, name: "Lakers" }];
    apiFetch.mockResolvedValue(teams);
    const result = await getTeams("nba");
    expect(result).toEqual(teams);
  });
});

describe("getStandings", () => {
  it("calls apiFetch with the correct path", async () => {
    await getStandings("nba");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/standings",
      expect.any(Object)
    );
  });

  it("passes season param when provided", async () => {
    await getStandings("nba", { season: "2024-25" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/standings",
      expect.objectContaining({ params: expect.objectContaining({ season: "2024-25" }) })
    );
  });

  it("passes undefined season when not provided", async () => {
    await getStandings("nba");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/standings",
      expect.objectContaining({ params: expect.objectContaining({ season: undefined }) })
    );
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getStandings("nhl", { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nhl/standings",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns the resolved value from apiFetch", async () => {
    const standings = { east: [], west: [] };
    apiFetch.mockResolvedValue(standings);
    const result = await getStandings("nba");
    expect(result).toEqual(standings);
  });
});
