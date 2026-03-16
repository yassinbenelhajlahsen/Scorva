import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must stub env before importing module
vi.stubEnv("VITE_API_URL", "http://localhost:8080");

const { apiFetch } = await import("../../api/client.js");

function mockFetch(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(200, { data: "ok" }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("constructs the correct URL from path", async () => {
    await apiFetch("/api/test");
    const [url] = fetch.mock.calls[0];
    expect(url.toString()).toBe("http://localhost:8080/api/test");
  });

  it("appends query params", async () => {
    await apiFetch("/api/search", { params: { q: "lakers", season: "2025" } });
    const [url] = fetch.mock.calls[0];
    expect(url.searchParams.get("q")).toBe("lakers");
    expect(url.searchParams.get("season")).toBe("2025");
  });

  it("skips null/undefined params", async () => {
    await apiFetch("/api/search", { params: { q: "lakers", season: null } });
    const [url] = fetch.mock.calls[0];
    expect(url.searchParams.has("season")).toBe(false);
  });

  it("sets Authorization header when token provided", async () => {
    await apiFetch("/api/favorites", { token: "abc123" });
    const [, options] = fetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBe("Bearer abc123");
  });

  it("does not set Authorization header when no token", async () => {
    await apiFetch("/api/games");
    const [, options] = fetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("sets Content-Type when body is provided", async () => {
    await apiFetch("/api/user/profile", { method: "PATCH", body: { name: "Test" } });
    const [, options] = fetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("does not set Content-Type when no body", async () => {
    await apiFetch("/api/games");
    const [, options] = fetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("JSON-stringifies the body", async () => {
    const payload = { firstName: "Yassin" };
    await apiFetch("/api/user/profile", { method: "PATCH", body: payload });
    const [, options] = fetch.mock.calls[0];
    expect(options.body).toBe(JSON.stringify(payload));
  });

  it("forwards abort signal to fetch", async () => {
    const controller = new AbortController();
    await apiFetch("/api/teams", { signal: controller.signal });
    const [, options] = fetch.mock.calls[0];
    expect(options.signal).toBe(controller.signal);
  });

  it("uses GET as default method", async () => {
    await apiFetch("/api/teams");
    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe("GET");
  });

  it("uses specified method", async () => {
    await apiFetch("/api/favorites/players/1", { method: "DELETE" });
    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe("DELETE");
  });

  it("returns parsed JSON on success", async () => {
    const result = await apiFetch("/api/teams");
    expect(result).toEqual({ data: "ok" });
  });

  it("returns null on 204 No Content", async () => {
    vi.stubGlobal("fetch", mockFetch(204, null));
    const result = await apiFetch("/api/favorites/players/1", { method: "DELETE" });
    expect(result).toBeNull();
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(404, { message: "Not found" }));
    await expect(apiFetch("/api/missing")).rejects.toThrow("HTTP 404");
  });

  it("throws on 500 server error", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}));
    await expect(apiFetch("/api/error")).rejects.toThrow("HTTP 500");
  });
});
