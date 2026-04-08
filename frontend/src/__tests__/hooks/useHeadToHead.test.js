import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/compare.js", () => ({ getHeadToHead: vi.fn() }));

const { getHeadToHead } = await import("../../api/compare.js");
const { useHeadToHead } = await import("../../hooks/data/useHeadToHead.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useHeadToHead", () => {
  it("does not fetch when IDs are missing", () => {
    getHeadToHead.mockResolvedValue({ games: [] });

    renderHook(() => useHeadToHead("nba", "players", null, null), {
      wrapper: createWrapper(),
    });

    expect(getHeadToHead).not.toHaveBeenCalled();
  });

  it("does not fetch when only one ID is provided", () => {
    getHeadToHead.mockResolvedValue({ games: [] });

    renderHook(() => useHeadToHead("nba", "players", 1, null), {
      wrapper: createWrapper(),
    });

    expect(getHeadToHead).not.toHaveBeenCalled();
  });

  it("fetches when both IDs are provided", async () => {
    const mockGames = [{ id: 1 }, { id: 2 }];
    getHeadToHead.mockResolvedValue({ games: mockGames });

    const { result } = renderHook(() => useHeadToHead("nba", "teams", 1, 2), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(mockGames));
    expect(getHeadToHead).toHaveBeenCalled();
  });

  it("does not fetch when league is empty", () => {
    getHeadToHead.mockResolvedValue({ games: [] });

    renderHook(() => useHeadToHead("", "teams", 1, 2), {
      wrapper: createWrapper(),
    });

    expect(getHeadToHead).not.toHaveBeenCalled();
  });

  it("does not fetch when type is empty", () => {
    getHeadToHead.mockResolvedValue({ games: [] });

    renderHook(() => useHeadToHead("nba", "", 1, 2), {
      wrapper: createWrapper(),
    });

    expect(getHeadToHead).not.toHaveBeenCalled();
  });
});
