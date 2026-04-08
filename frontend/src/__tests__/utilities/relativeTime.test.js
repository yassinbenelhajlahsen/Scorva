import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { relativeTime } from "../../utils/relativeTime.js";

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for timestamps within 1 minute", () => {
    expect(relativeTime("2026-04-08T11:59:30Z")).toBe("just now");
  });

  it("returns minutes ago for 1–59 minutes", () => {
    expect(relativeTime("2026-04-08T11:55:00Z")).toBe("5m ago");
    expect(relativeTime("2026-04-08T11:01:00Z")).toBe("59m ago");
  });

  it("returns hours ago for 1–23 hours", () => {
    expect(relativeTime("2026-04-08T09:00:00Z")).toBe("3h ago");
    expect(relativeTime("2026-04-07T13:00:00Z")).toBe("23h ago");
  });

  it("returns '1d ago' for exactly 1 day", () => {
    expect(relativeTime("2026-04-07T12:00:00Z")).toBe("1d ago");
  });

  it("returns days ago for 2–29 days", () => {
    expect(relativeTime("2026-03-29T12:00:00Z")).toBe("10d ago");
  });

  it("returns short date format for 30+ days", () => {
    const result = relativeTime("2026-02-01T12:00:00Z");
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it("handles edge at exactly 1 minute", () => {
    expect(relativeTime("2026-04-08T11:59:00Z")).toBe("1m ago");
  });

  it("handles edge at exactly 1 hour", () => {
    expect(relativeTime("2026-04-08T11:00:00Z")).toBe("1h ago");
  });
});
