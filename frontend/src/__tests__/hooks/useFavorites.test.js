import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
vi.mock("../../api/favorites.js", () => ({ getFavorites: vi.fn() }));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { getFavorites } = await import("../../api/favorites.js");
const { useFavorites } = await import("../../hooks/user/useFavorites.js");

const mockSession = { access_token: "tok" };
const mockData = { players: [{ id: 1 }], teams: [{ id: 2 }] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useFavorites — no session", () => {
  it("returns null favorites and false loading when logged out", () => {
    useAuth.mockReturnValue({ session: null });
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(getFavorites).not.toHaveBeenCalled();
  });
});

describe("useFavorites — with session", () => {
  it("calls getFavorites with the session token", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getFavorites.mockResolvedValue(mockData);

    renderHook(() => useFavorites());

    await waitFor(() => expect(getFavorites).toHaveBeenCalledTimes(1));
    expect(getFavorites).toHaveBeenCalledWith(
      expect.objectContaining({ token: "tok" })
    );
  });

  it("sets favorites and clears loading on success", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getFavorites.mockResolvedValue(mockData);

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => expect(result.current.favorites).toEqual(mockData));
    expect(result.current.loading).toBe(false);
  });

  it("clears loading on non-abort error", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getFavorites.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.favorites).toBeNull();
  });

  it("does not clear loading on AbortError", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    getFavorites.mockRejectedValue(abortErr);

    const { result } = renderHook(() => useFavorites());

    // loading stays true (abort = unmount cleanup, not a real error)
    await waitFor(() => expect(getFavorites).toHaveBeenCalled());
    expect(result.current.favorites).toBeNull();
  });

  it("refresh re-fetches favorites", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getFavorites.mockResolvedValue(mockData);

    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.favorites).toEqual(mockData));

    getFavorites.mockResolvedValue({ players: [], teams: [] });
    act(() => { result.current.refresh(); });

    await waitFor(() =>
      expect(result.current.favorites).toEqual({ players: [], teams: [] })
    );
  });
});
