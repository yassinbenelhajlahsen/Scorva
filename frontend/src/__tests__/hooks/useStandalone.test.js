// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

let mockUserAgent;
let mockStandalone;
let mockMatches;

beforeEach(() => {
  vi.resetModules();
  mockUserAgent = "";
  mockStandalone = undefined;
  mockMatches = false;

  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => mockUserAgent,
  });
  Object.defineProperty(window.navigator, "standalone", {
    configurable: true,
    get: () => mockStandalone,
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    get: () => (mockUserAgent.includes("iPad") ? 5 : 0),
  });
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: mockMatches,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

async function importHook() {
  const mod = await import("../../hooks/useStandalone.js");
  return mod.useStandalone;
}

describe("useStandalone", () => {
  it("detects iOS Safari on iPhone", async () => {
    mockUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current).toEqual({ isIOS: true, isSafari: true, isStandalone: false });
  });

  it("detects iOS Chrome (CriOS) as not Safari", async () => {
    mockUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.0.0 Mobile/15E148 Safari/604.1";
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current).toEqual({ isIOS: true, isSafari: false, isStandalone: false });
  });

  it("detects iPadOS Safari (UA reports as Mac, but has touch)", async () => {
    mockUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 iPad";
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current.isIOS).toBe(true);
  });

  it("returns isStandalone=true when navigator.standalone is true", async () => {
    mockUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    mockStandalone = true;
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current.isStandalone).toBe(true);
  });

  it("returns isStandalone=true when display-mode media query matches", async () => {
    mockUserAgent = "Mozilla/5.0 (Linux; Android 10) Chrome/118 Mobile";
    mockMatches = true;
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current.isStandalone).toBe(true);
  });

  it("returns all false on desktop Chrome", async () => {
    mockUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current).toEqual({ isIOS: false, isSafari: false, isStandalone: false });
  });
});
