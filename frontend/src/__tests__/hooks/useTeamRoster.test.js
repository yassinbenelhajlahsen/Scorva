// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/teams.js", () => ({
  getTeamRoster: vi.fn(),
}));

const { getTeamRoster } = await import("../../api/teams.js");
const { useTeamRoster } = await import("../../hooks/data/useTeamRoster.js");

const mockRoster = [
  { id: 1, name: "LeBron James", position: "F", jerseynum: 23, image_url: null, status: null, status_description: null, status_updated_at: null, espn_playerid: 1966 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTeamRoster", () => {
  it("returns the roster data", async () => {
    getTeamRoster.mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useTeamRoster("nba", 17, "2025-26"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.roster).toEqual(mockRoster));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("passes season to the API call", async () => {
    getTeamRoster.mockResolvedValue([]);

    renderHook(
      () => useTeamRoster("nba", 17, "2022-23"),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(getTeamRoster).toHaveBeenCalledWith(
        "nba",
        17,
        expect.objectContaining({ season: "2022-23" })
      )
    );
  });

  it("does not fetch when enabled is false", async () => {
    getTeamRoster.mockResolvedValue([]);

    renderHook(
      () => useTeamRoster("nba", 17, null, { enabled: false }),
      { wrapper: createWrapper() }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(getTeamRoster).not.toHaveBeenCalled();
  });

  it("does not fetch when teamId is null", async () => {
    getTeamRoster.mockResolvedValue([]);

    renderHook(
      () => useTeamRoster("nba", null, null),
      { wrapper: createWrapper() }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(getTeamRoster).not.toHaveBeenCalled();
  });

  it("surfaces error message on failure", async () => {
    getTeamRoster.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(
      () => useTeamRoster("nba", 17, null),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.loading).toBe(false);
  });

  it("retry refetches the roster", async () => {
    getTeamRoster.mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useTeamRoster("nba", 17, null),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.retry());
    await waitFor(() => expect(getTeamRoster).toHaveBeenCalledTimes(2));
  });
});
