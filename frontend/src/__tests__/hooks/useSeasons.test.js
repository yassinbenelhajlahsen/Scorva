// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/seasons.js", () => ({ getSeasons: vi.fn() }));

const { getSeasons } = await import("../../api/seasons.js");
const { useSeasons } = await import("../../hooks/data/useSeasons.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSeasons", () => {
  it("returns empty seasons initially", () => {
    getSeasons.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSeasons("nba"), {
      wrapper: createWrapper(),
    });
    expect(result.current.seasons).toEqual([]);
  });

  it("calls getSeasons with the correct league", async () => {
    getSeasons.mockResolvedValue(["2024-25", "2023-24"]);
    renderHook(() => useSeasons("nba"), { wrapper: createWrapper() });
    await waitFor(() =>
      expect(getSeasons).toHaveBeenCalledWith(
        "nba",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
  });

  it("sets seasons on successful fetch", async () => {
    const seasons = ["2024-25", "2023-24", "2022-23"];
    getSeasons.mockResolvedValue(seasons);

    const { result } = renderHook(() => useSeasons("nba"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.seasons).toEqual(seasons));
  });

  it("refetches when league changes", async () => {
    getSeasons.mockResolvedValue(["2024-25"]);
    const { rerender } = renderHook(({ league }) => useSeasons(league), {
      initialProps: { league: "nba" },
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(getSeasons).toHaveBeenCalledWith("nba", expect.any(Object))
    );

    rerender({ league: "nfl" });
    await waitFor(() =>
      expect(getSeasons).toHaveBeenCalledWith("nfl", expect.any(Object))
    );
    expect(getSeasons).toHaveBeenCalledTimes(2);
  });

  it("returns empty seasons on error", async () => {
    getSeasons.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useSeasons("nba"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getSeasons).toHaveBeenCalled());
    expect(result.current.seasons).toEqual([]);
  });
});
