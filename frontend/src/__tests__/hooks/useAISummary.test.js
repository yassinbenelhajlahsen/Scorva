// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
vi.mock("../../api/ai.js", () => ({
  streamAISummary: vi.fn(),
  getAISummary: vi.fn(),
}));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { streamAISummary } = await import("../../api/ai.js");
const { useAISummary } = await import("../../hooks/ai/useAISummary.js");

const mockSession = { access_token: "tok" };

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: make streamAISummary immediately call the given callbacks
function mockStream({ bullets = [], error = null } = {}) {
  streamAISummary.mockImplementation((_gameId, { onBullet, onFull, onDone, onError }) => {
    if (error) {
      onError(error);
      return;
    }
    for (const text of bullets) {
      onBullet(text);
    }
    onDone();
  });
}

function mockStreamFull(summary, cached = true) {
  streamAISummary.mockImplementation((_gameId, { onFull, onDone }) => {
    onFull(summary, cached);
    onDone();
  });
}

describe("useAISummary — auth loading (session undefined)", () => {
  it("does not call streamAISummary while session is undefined", () => {
    useAuth.mockReturnValue({ session: undefined });
    renderHook(() => useAISummary(42));
    expect(streamAISummary).not.toHaveBeenCalled();
  });

  it("stays loading while session is undefined", () => {
    useAuth.mockReturnValue({ session: undefined });
    const { result } = renderHook(() => useAISummary(42));
    expect(result.current.loading).toBe(true);
  });
});

describe("useAISummary — no session", () => {
  it("does not call streamAISummary when logged out", () => {
    useAuth.mockReturnValue({ session: null });
    renderHook(() => useAISummary(42));
    expect(streamAISummary).not.toHaveBeenCalled();
  });

  it("sets loading to false when logged out", async () => {
    useAuth.mockReturnValue({ session: null });
    const { result } = renderHook(() => useAISummary(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bullets).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

describe("useAISummary — no gameId", () => {
  it("does not call streamAISummary when gameId is null", () => {
    useAuth.mockReturnValue({ session: mockSession });
    renderHook(() => useAISummary(null));
    expect(streamAISummary).not.toHaveBeenCalled();
  });
});

describe("useAISummary — streaming bullets", () => {
  it("accumulates bullets progressively and clears loading on done", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    mockStream({ bullets: ["Bullet 1", "Bullet 2", "Bullet 3"] });

    const { result } = renderHook(() => useAISummary(42));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bullets).toEqual(["Bullet 1", "Bullet 2", "Bullet 3"]);
    expect(result.current.error).toBeNull();
  });

  it("calls streamAISummary with gameId and token", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    mockStream({ bullets: ["A", "B", "C"] });

    renderHook(() => useAISummary(42));

    await waitFor(() => expect(streamAISummary).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ token: "tok", signal: expect.any(AbortSignal) })
    ));
  });

  it("sets error and stops loading on onError", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    mockStream({ error: "Something went wrong" });

    const { result } = renderHook(() => useAISummary(42));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Something went wrong");
    expect(result.current.bullets).toEqual([]);
  });
});

describe("useAISummary — cached (onFull path)", () => {
  it("sets all bullets at once and cached=true via onFull", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    mockStreamFull("- Insight 1\n- Insight 2\n- Insight 3", true);

    const { result } = renderHook(() => useAISummary(42));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bullets).toEqual(["Insight 1", "Insight 2", "Insight 3"]);
    expect(result.current.cached).toBe(true);
  });

  it("parses bullets from the full summary text", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    mockStreamFull("- First bullet\n- Second bullet", false);

    const { result } = renderHook(() => useAISummary(42));

    await waitFor(() => expect(result.current.bullets).toHaveLength(2));
    expect(result.current.bullets[0]).toBe("First bullet");
    expect(result.current.bullets[1]).toBe("Second bullet");
  });
});

describe("useAISummary — re-fetch on gameId change", () => {
  it("resets state and calls streamAISummary again when gameId changes", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    mockStream({ bullets: ["A", "B", "C"] });

    const { result, rerender } = renderHook(({ id }) => useAISummary(id), {
      initialProps: { id: 1 },
    });

    await waitFor(() => expect(result.current.bullets).toHaveLength(3));

    mockStream({ bullets: ["X", "Y", "Z"] });
    act(() => rerender({ id: 2 }));

    await waitFor(() => expect(result.current.bullets).toEqual(["X", "Y", "Z"]));
    expect(streamAISummary).toHaveBeenCalledWith(2, expect.any(Object));
  });
});
