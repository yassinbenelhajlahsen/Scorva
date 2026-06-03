// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getSlateDateET,
  parseStartTime,
  compactTime,
  statusGroup,
  resolveLeagueFilter,
  slateLabel,
} from "../../utils/slateDate.js";

describe("getSlateDateET", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today's ET date when current ET hour >= 6", () => {
    // 2026-05-02 12:00 UTC = 2026-05-02 08:00 ET (after 6 AM cutover)
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
    expect(getSlateDateET()).toBe("2026-05-02");
  });

  it("rolls back to yesterday's ET date when current ET hour < 6", () => {
    // 2026-05-02 07:00 UTC = 2026-05-02 03:00 ET (before 6 AM cutover)
    vi.setSystemTime(new Date("2026-05-02T07:00:00Z"));
    expect(getSlateDateET()).toBe("2026-05-01");
  });
});

describe("parseStartTime", () => {
  it("parses '7:30PM ET' to 19*60 + 30", () => {
    expect(parseStartTime("7:30PM ET")).toBe(19 * 60 + 30);
  });

  it("parses '7PM ET' (no minutes) to 19*60", () => {
    expect(parseStartTime("7PM ET")).toBe(19 * 60);
  });

  it("treats '12AM ET' as a placeholder and sorts it to the end", () => {
    // ESPN emits 12AM ET when tipoff is TBD — no real ET game starts at midnight.
    expect(parseStartTime("12AM ET")).toBe(9999);
  });

  it("parses '12PM ET' as noon (12*60)", () => {
    expect(parseStartTime("12PM ET")).toBe(12 * 60);
  });

  it("returns 9999 for null/empty/garbage", () => {
    expect(parseStartTime(null)).toBe(9999);
    expect(parseStartTime("")).toBe(9999);
    expect(parseStartTime("TBD")).toBe(9999);
  });
});

describe("compactTime", () => {
  it("strips ' ET' and shortens 'PM'/'AM' to single letter", () => {
    expect(compactTime("7:30PM ET")).toBe("7:30P");
    expect(compactTime("11AM ET")).toBe("11A");
  });
  it("returns 'TBD' for null/empty", () => {
    expect(compactTime(null)).toBe("TBD");
    expect(compactTime("")).toBe("TBD");
  });
});

describe("statusGroup", () => {
  it("returns 'final' for Final statuses", () => {
    expect(statusGroup({ status: "Final" })).toBe("final");
    expect(statusGroup({ status: "Final/OT" })).toBe("final");
  });
  it("returns 'live' for In Progress / Halftime / End of Period", () => {
    expect(statusGroup({ status: "In Progress" })).toBe("live");
    expect(statusGroup({ status: "Halftime" })).toBe("live");
    expect(statusGroup({ status: "End of Period" })).toBe("live");
  });
  it("returns 'scheduled' otherwise", () => {
    expect(statusGroup({ status: "Scheduled" })).toBe("scheduled");
    expect(statusGroup({ status: undefined })).toBe("scheduled");
    expect(statusGroup({})).toBe("scheduled");
  });
});

describe("slateLabel", () => {
  // 2026-05-02 12:00 UTC = 08:00 ET → slate date is 2026-05-02
  const TODAY = "2026-05-02";
  const FUTURE = "2026-05-05";
  const PAST = "2026-04-28";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Games' for empty/missing input", () => {
    expect(slateLabel([])).toBe("Games");
    expect(slateLabel(null)).toBe("Games");
    expect(slateLabel(undefined)).toBe("Games");
  });

  it("returns 'Live Now' when any game is live, regardless of mix", () => {
    expect(
      slateLabel([
        { status: "Final", date: TODAY },
        { status: "In Progress", date: TODAY },
        { status: "Scheduled", date: FUTURE },
      ])
    ).toBe("Live Now");
  });

  it("treats a yesterday carry-over live game as 'Live Now'", () => {
    expect(slateLabel([{ status: "Halftime", date: "2026-05-01" }])).toBe(
      "Live Now"
    );
  });

  it("returns 'Today's Games' when a game today is Final", () => {
    expect(
      slateLabel([
        { status: "Final", date: TODAY },
        { status: "Scheduled", date: FUTURE },
      ])
    ).toBe("Today's Games");
  });

  it("returns 'Today's Games' when games are scheduled for today", () => {
    expect(
      slateLabel([
        { status: "Scheduled", date: TODAY },
        { status: "Scheduled", date: FUTURE },
      ])
    ).toBe("Today's Games");
  });

  it("returns 'Upcoming Games' for only future scheduled games (Finals gap)", () => {
    expect(
      slateLabel([
        { status: "Scheduled", date: FUTURE },
        { status: "Scheduled", date: "2026-05-07" },
      ])
    ).toBe("Upcoming Games");
  });

  it("returns 'Recent Games' for the off-season fallback of past finals", () => {
    expect(
      slateLabel([
        { status: "Final", date: PAST },
        { status: "Final/OT", date: "2026-04-27" },
      ])
    ).toBe("Recent Games");
  });

  it("handles ISO timestamp date strings", () => {
    expect(
      slateLabel([{ status: "Final", date: "2026-05-02T00:00:00.000Z" }])
    ).toBe("Today's Games");
  });
});

describe("resolveLeagueFilter", () => {
  it("returns the league when first segment is nba/nfl/nhl", () => {
    expect(resolveLeagueFilter("/nba")).toBe("nba");
    expect(resolveLeagueFilter("/nfl/games/123")).toBe("nfl");
    expect(resolveLeagueFilter("/nhl/players/abc")).toBe("nhl");
  });
  it("returns null for the root path and non-league routes", () => {
    expect(resolveLeagueFilter("/")).toBe(null);
    expect(resolveLeagueFilter("/reports")).toBe(null);
    expect(resolveLeagueFilter("/settings")).toBe(null);
    expect(resolveLeagueFilter("/compare")).toBe(null);
    expect(resolveLeagueFilter("/about")).toBe(null);
  });
});
