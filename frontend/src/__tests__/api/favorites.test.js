import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../../api/client.js");
const {
  getFavorites,
  checkFavorites,
  addFavoritePlayer,
  removeFavoritePlayer,
  addFavoriteTeam,
  removeFavoriteTeam,
} = await import("../../api/favorites.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({});
});

describe("getFavorites", () => {
  it("calls /api/favorites with token", async () => {
    await getFavorites({ token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith("/api/favorites", expect.objectContaining({ token: "tok" }));
  });
});

describe("checkFavorites", () => {
  it("sends playerIds as comma-separated param", async () => {
    await checkFavorites({ playerIds: [1, 2, 3], teamIds: [], token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/favorites/check",
      expect.objectContaining({ params: expect.objectContaining({ playerIds: "1,2,3" }) })
    );
  });

  it("omits playerIds param when empty array", async () => {
    await checkFavorites({ playerIds: [], teamIds: [5], token: "tok" });
    const call = apiFetch.mock.calls[0][1];
    expect(call.params.playerIds).toBeUndefined();
    expect(call.params.teamIds).toBe("5");
  });
});

describe("addFavoritePlayer", () => {
  it("POSTs to correct player path", async () => {
    await addFavoritePlayer(42, { token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/favorites/players/42",
      expect.objectContaining({ method: "POST", token: "tok" })
    );
  });
});

describe("removeFavoritePlayer", () => {
  it("DELETEs from correct player path", async () => {
    await removeFavoritePlayer(42, { token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/favorites/players/42",
      expect.objectContaining({ method: "DELETE", token: "tok" })
    );
  });
});

describe("addFavoriteTeam", () => {
  it("POSTs to correct team path", async () => {
    await addFavoriteTeam(7, { token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/favorites/teams/7",
      expect.objectContaining({ method: "POST", token: "tok" })
    );
  });
});

describe("removeFavoriteTeam", () => {
  it("DELETEs from correct team path", async () => {
    await removeFavoriteTeam(7, { token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/favorites/teams/7",
      expect.objectContaining({ method: "DELETE", token: "tok" })
    );
  });
});
