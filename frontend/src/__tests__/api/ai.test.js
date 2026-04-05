import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getAISummary } = await import("../../api/ai.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ summary: "" });
});

describe("getAISummary", () => {
  it("calls apiFetch with the correct path", async () => {
    await getAISummary(42);
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/games/42/ai-summary",
      expect.any(Object)
    );
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getAISummary(42, { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/games/42/ai-summary",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("passes token when provided", async () => {
    await getAISummary(42, { token: "my-token" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/games/42/ai-summary",
      expect.objectContaining({ token: "my-token" })
    );
  });

  it("returns the resolved value from apiFetch", async () => {
    const summary = { summary: "The Lakers won 120-110.", generatedAt: "2025-01-15T00:00:00Z" };
    apiFetch.mockResolvedValue(summary);
    const result = await getAISummary(99);
    expect(result).toEqual(summary);
  });
});
