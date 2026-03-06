import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
vi.mock("../../api/favorites.js", () => ({
  checkFavorites: vi.fn(),
  addFavoritePlayer: vi.fn(),
  removeFavoritePlayer: vi.fn(),
  addFavoriteTeam: vi.fn(),
  removeFavoriteTeam: vi.fn(),
}));

const { useAuth } = await import("../../context/AuthContext.jsx");
const {
  checkFavorites,
  addFavoritePlayer,
  removeFavoritePlayer,
  addFavoriteTeam,
  removeFavoriteTeam,
} = await import("../../api/favorites.js");
const { useFavoriteToggle } = await import("../../hooks/useFavoriteToggle.js");

const mockSession = { access_token: "tok" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useFavoriteToggle — no session", () => {
  it("returns isFavorited=false and does not call checkFavorites", () => {
    useAuth.mockReturnValue({ session: null });
    const { result } = renderHook(() => useFavoriteToggle("player", 1));
    expect(result.current.isFavorited).toBe(false);
    expect(checkFavorites).not.toHaveBeenCalled();
  });

  it("toggle does nothing when no session", async () => {
    useAuth.mockReturnValue({ session: null });
    const { result } = renderHook(() => useFavoriteToggle("player", 1));
    await act(() => result.current.toggle());
    expect(addFavoritePlayer).not.toHaveBeenCalled();
  });
});

describe("useFavoriteToggle — initial check (player)", () => {
  it("sets isFavorited=true when player is in favorites", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [1], teamIds: [] });

    const { result } = renderHook(() => useFavoriteToggle("player", 1));

    await waitFor(() => expect(result.current.isFavorited).toBe(true));
  });

  it("sets isFavorited=false when player is not in favorites", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [], teamIds: [] });

    const { result } = renderHook(() => useFavoriteToggle("player", 1));

    await waitFor(() => expect(checkFavorites).toHaveBeenCalled());
    expect(result.current.isFavorited).toBe(false);
  });
});

describe("useFavoriteToggle — initial check (team)", () => {
  it("sets isFavorited=true when team is in favorites", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [], teamIds: [7] });

    const { result } = renderHook(() => useFavoriteToggle("team", 7));

    await waitFor(() => expect(result.current.isFavorited).toBe(true));
  });

  it("sets isFavorited=false when team is not in favorites", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [], teamIds: [] });

    const { result } = renderHook(() => useFavoriteToggle("team", 7));

    await waitFor(() => expect(checkFavorites).toHaveBeenCalled());
    expect(result.current.isFavorited).toBe(false);
  });
});

describe("useFavoriteToggle — toggle (player, not favorited → add)", () => {
  it("optimistically sets true and calls addFavoritePlayer", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [], teamIds: [] });
    addFavoritePlayer.mockResolvedValue(null);

    const { result } = renderHook(() => useFavoriteToggle("player", 1));
    await waitFor(() => expect(checkFavorites).toHaveBeenCalled());

    await act(() => result.current.toggle());

    expect(result.current.isFavorited).toBe(true);
    expect(addFavoritePlayer).toHaveBeenCalledWith(1, { token: "tok" });
  });
});

describe("useFavoriteToggle — toggle (player, favorited → remove)", () => {
  it("optimistically sets false and calls removeFavoritePlayer", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [1], teamIds: [] });
    removeFavoritePlayer.mockResolvedValue(null);

    const { result } = renderHook(() => useFavoriteToggle("player", 1));
    await waitFor(() => expect(result.current.isFavorited).toBe(true));

    await act(() => result.current.toggle());

    expect(result.current.isFavorited).toBe(false);
    expect(removeFavoritePlayer).toHaveBeenCalledWith(1, { token: "tok" });
  });
});

describe("useFavoriteToggle — toggle (team)", () => {
  it("calls addFavoriteTeam when team is not favorited", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [], teamIds: [] });
    addFavoriteTeam.mockResolvedValue(null);

    const { result } = renderHook(() => useFavoriteToggle("team", 7));
    await waitFor(() => expect(checkFavorites).toHaveBeenCalled());

    await act(() => result.current.toggle());

    expect(addFavoriteTeam).toHaveBeenCalledWith(7, { token: "tok" });
    expect(result.current.isFavorited).toBe(true);
  });

  it("calls removeFavoriteTeam when team is favorited", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [], teamIds: [7] });
    removeFavoriteTeam.mockResolvedValue(null);

    const { result } = renderHook(() => useFavoriteToggle("team", 7));
    await waitFor(() => expect(result.current.isFavorited).toBe(true));

    await act(() => result.current.toggle());

    expect(removeFavoriteTeam).toHaveBeenCalledWith(7, { token: "tok" });
    expect(result.current.isFavorited).toBe(false);
  });
});

describe("useFavoriteToggle — error rollback", () => {
  it("rolls back isFavorited when addFavoritePlayer throws", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [], teamIds: [] });
    addFavoritePlayer.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useFavoriteToggle("player", 1));
    await waitFor(() => expect(checkFavorites).toHaveBeenCalled());

    await act(() => result.current.toggle());

    // Should roll back to false after the optimistic true
    expect(result.current.isFavorited).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("rolls back isFavorited when removeFavoritePlayer throws", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [1], teamIds: [] });
    removeFavoritePlayer.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useFavoriteToggle("player", 1));
    await waitFor(() => expect(result.current.isFavorited).toBe(true));

    await act(() => result.current.toggle());

    // Should roll back to true after the optimistic false
    expect(result.current.isFavorited).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});

describe("useFavoriteToggle — loading guard", () => {
  it("does not double-toggle while loading", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    checkFavorites.mockResolvedValue({ playerIds: [], teamIds: [] });
    // Never resolves — keeps loading=true
    addFavoritePlayer.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFavoriteToggle("player", 1));
    await waitFor(() => expect(checkFavorites).toHaveBeenCalled());

    // Fire toggle twice rapidly
    act(() => { result.current.toggle(); });
    await act(() => result.current.toggle());

    // Should only have been called once
    expect(addFavoritePlayer).toHaveBeenCalledTimes(1);
  });
});
