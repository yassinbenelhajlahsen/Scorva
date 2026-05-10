// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/topPerformances.js", () => ({
  getTopPerformances: vi.fn(),
}));

const { getTopPerformances } = await import("../../api/topPerformances.js");
const { useTopPerformances } = await import("../../hooks/data/useTopPerformances.js");

describe("useTopPerformances", () => {
  beforeEach(() => getTopPerformances.mockReset());

  it("forwards fallback:true to the API", async () => {
    getTopPerformances.mockResolvedValueOnce({
      type: "performances", window: "week", actualWindow: "month", performances: [],
    });
    const { result } = renderHook(
      () => useTopPerformances("nba", { type: "performances", window: "week", fallback: true }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(getTopPerformances).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ fallback: true, window: "week" }),
    );
  });

  it("defaults fallback to false", async () => {
    getTopPerformances.mockResolvedValueOnce({
      type: "performances", window: "week", performances: [],
    });
    const { result } = renderHook(
      () => useTopPerformances("nba", { type: "performances", window: "week" }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(getTopPerformances).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ fallback: false }),
    );
  });
});
