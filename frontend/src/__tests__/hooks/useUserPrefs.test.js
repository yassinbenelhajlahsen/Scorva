// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
vi.mock("../../api/user.js", () => ({ getProfile: vi.fn() }));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { getProfile } = await import("../../api/user.js");
const { useUserPrefs } = await import("../../hooks/user/useUserPrefs.js");

const mockSession = { access_token: "tok" };
const mockProfile = { id: "u1", email: "test@example.com", default_league: "nfl" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUserPrefs — no session", () => {
  it("returns null prefs and false loading when logged out", () => {
    useAuth.mockReturnValue({ session: null });
    const { result } = renderHook(() => useUserPrefs(), {
      wrapper: createWrapper(),
    });
    expect(result.current.prefs).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(getProfile).not.toHaveBeenCalled();
  });
});

describe("useUserPrefs — with session", () => {
  it("calls getProfile with the session token", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getProfile.mockResolvedValue(mockProfile);

    renderHook(() => useUserPrefs(), { wrapper: createWrapper() });

    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1));
    expect(getProfile).toHaveBeenCalledWith(
      expect.objectContaining({ token: "tok" })
    );
  });

  it("sets prefs and clears loading on success", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getProfile.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUserPrefs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.prefs).toEqual(mockProfile));
    expect(result.current.loading).toBe(false);
  });

  it("clears loading on error", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getProfile.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUserPrefs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.prefs).toBeNull();
  });

  it("exposes default_league from prefs", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getProfile.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUserPrefs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.prefs).not.toBeNull());
    expect(result.current.prefs.default_league).toBe("nfl");
  });

  it("refresh re-fetches and updates prefs", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getProfile.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUserPrefs(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.prefs).toEqual(mockProfile));

    const updatedProfile = { ...mockProfile, default_league: "nhl" };
    getProfile.mockResolvedValue(updatedProfile);
    act(() => {
      result.current.refresh();
    });

    await waitFor(() =>
      expect(result.current.prefs.default_league).toBe("nhl")
    );
  });
});
