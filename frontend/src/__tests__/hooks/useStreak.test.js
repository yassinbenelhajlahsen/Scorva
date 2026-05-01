// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/streaks.js", () => ({
  getStreak: vi.fn(),
}));

const { getStreak } = await import("../../api/streaks.js");
const { useStreak } = await import("../../hooks/data/useStreak.js");

describe("useStreak", () => {
  beforeEach(() => {
    getStreak.mockReset();
  });

  it("fetches the streak when enabled", async () => {
    getStreak.mockResolvedValueOnce({
      streak: { length: 5, statLabel: "triple-double", subjectType: "player" },
    });
    const { result } = renderHook(
      () => useStreak("nba", "player", 42),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.streak).toBeTruthy());
    expect(result.current.streak).toEqual({
      length: 5, statLabel: "triple-double", subjectType: "player",
    });
    expect(getStreak).toHaveBeenCalledWith("nba", "player", 42, expect.any(Object));
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(
      () => useStreak("nba", "player", 42, { enabled: false }),
      { wrapper: createWrapper() },
    );
    expect(result.current.streak).toBeNull();
    expect(getStreak).not.toHaveBeenCalled();
  });

  it("does not fetch when subjectId is null", async () => {
    const { result } = renderHook(
      () => useStreak("nba", "player", null),
      { wrapper: createWrapper() },
    );
    expect(result.current.streak).toBeNull();
    expect(getStreak).not.toHaveBeenCalled();
  });

  it("returns null streak when API responds with null", async () => {
    getStreak.mockResolvedValueOnce({ streak: null });
    const { result } = renderHook(
      () => useStreak("nba", "team", 7),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.streak).toBeNull();
  });
});
