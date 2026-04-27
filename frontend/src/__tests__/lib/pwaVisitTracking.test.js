// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { trackVisit, getVisitCount } from "../../lib/pwaVisitTracking.js";

describe("pwaVisitTracking", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00Z"));
  });

  describe("trackVisit", () => {
    it("sets count=1 and timestamp on first call", () => {
      trackVisit();
      expect(localStorage.getItem("scorva:visit-count")).toBe("1");
      expect(localStorage.getItem("scorva:visit-last")).toBe(String(Date.now()));
    });

    it("does not increment when called again within 1 hour", () => {
      trackVisit();
      vi.advanceTimersByTime(59 * 60 * 1000); // 59 minutes
      trackVisit();
      expect(localStorage.getItem("scorva:visit-count")).toBe("1");
    });

    it("increments when called after 1 hour", () => {
      trackVisit();
      vi.advanceTimersByTime(60 * 60 * 1000 + 1); // 1 hour + 1ms
      trackVisit();
      expect(localStorage.getItem("scorva:visit-count")).toBe("2");
    });
  });

  describe("getVisitCount", () => {
    it("returns 0 when never tracked", () => {
      expect(getVisitCount()).toBe(0);
    });

    it("returns the parsed count after tracking", () => {
      trackVisit();
      expect(getVisitCount()).toBe(1);
    });

    it("returns 0 when stored value is non-numeric (defensive)", () => {
      localStorage.setItem("scorva:visit-count", "garbage");
      expect(getVisitCount()).toBe(0);
    });
  });
});
