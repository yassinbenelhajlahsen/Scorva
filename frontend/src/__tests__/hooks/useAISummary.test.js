import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
vi.mock("../../api/ai.js", () => ({ getAISummary: vi.fn() }));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { getAISummary } = await import("../../api/ai.js");
const { useAISummary } = await import("../../hooks/ai/useAISummary.js");

const mockSession = { access_token: "tok" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAISummary — auth loading (session undefined)", () => {
  it("does not call getAISummary while session is undefined", () => {
    useAuth.mockReturnValue({ session: undefined });
    renderHook(() => useAISummary(42));
    expect(getAISummary).not.toHaveBeenCalled();
  });

  it("stays loading while session is undefined", () => {
    useAuth.mockReturnValue({ session: undefined });
    const { result } = renderHook(() => useAISummary(42));
    expect(result.current.loading).toBe(true);
  });
});

describe("useAISummary — no session", () => {
  it("does not call getAISummary when logged out", () => {
    useAuth.mockReturnValue({ session: null });
    renderHook(() => useAISummary(42));
    expect(getAISummary).not.toHaveBeenCalled();
  });

  it("sets loading to false when logged out", async () => {
    useAuth.mockReturnValue({ session: null });
    const { result } = renderHook(() => useAISummary(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBe(false);
  });
});

describe("useAISummary — no gameId", () => {
  it("does not call getAISummary when gameId is null", () => {
    useAuth.mockReturnValue({ session: mockSession });
    renderHook(() => useAISummary(null));
    expect(getAISummary).not.toHaveBeenCalled();
  });
});

describe("useAISummary — with session and gameId", () => {
  it("calls getAISummary with gameId and token", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getAISummary.mockResolvedValue({ summary: "Great game." });

    renderHook(() => useAISummary(42));

    await waitFor(() =>
      expect(getAISummary).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ token: "tok", signal: expect.any(AbortSignal) })
      )
    );
  });

  it("sets summary and clears loading on success", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getAISummary.mockResolvedValue({ summary: "Lakers win!" });

    const { result } = renderHook(() => useAISummary(42));

    await waitFor(() => expect(result.current.summary).toBe("Lakers win!"));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets error and fallback summary on fetch failure", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getAISummary.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAISummary(42));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toBe("AI summary unavailable for this game.");
  });

  it("does not set error on AbortError", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    getAISummary.mockRejectedValue(abortErr);

    const { result } = renderHook(() => useAISummary(42));

    await waitFor(() => expect(getAISummary).toHaveBeenCalled());
    expect(result.current.error).toBe(false);
    expect(result.current.summary).toBeNull();
  });

  it("re-fetches when gameId changes", async () => {
    useAuth.mockReturnValue({ session: mockSession });
    getAISummary.mockResolvedValue({ summary: "Game 1" });

    const { rerender } = renderHook(({ id }) => useAISummary(id), {
      initialProps: { id: 1 },
    });

    await waitFor(() => expect(getAISummary).toHaveBeenCalledWith(1, expect.any(Object)));

    getAISummary.mockResolvedValue({ summary: "Game 2" });
    rerender({ id: 2 });

    await waitFor(() => expect(getAISummary).toHaveBeenCalledWith(2, expect.any(Object)));
  });
});
