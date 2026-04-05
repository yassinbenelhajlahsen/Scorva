import { describe, it, expect } from "vitest";
import formatDate, {
  formatDateShort,
  getPeriodLabel,
  formatDateShortWithTime,
  formatDateWithTime,
  parseUTC,
  toUTCDateString,
  addDays,
} from "../../utils/formatDate.js";

describe("formatDate", () => {
  it("formats ISO YYYY-MM-DD", () => {
    expect(formatDate("2025-01-15")).toBe("January 15th, 2025");
  });

  it("formats slash D/M/YYYY", () => {
    expect(formatDate("15/01/2025")).toBe("January 15th, 2025");
  });

  it("returns 'Unknown' for null", () => {
    expect(formatDate(null)).toBe("Unknown");
  });

  it("returns 'Unknown' for empty string", () => {
    expect(formatDate("")).toBe("Unknown");
  });

  it("returns 'Invalid date' for garbage input", () => {
    expect(formatDate("not-a-date")).toBe("Invalid date");
  });

  it("ordinal: 1st", () => {
    expect(formatDate("2025-03-01")).toBe("March 1st, 2025");
  });

  it("ordinal: 2nd", () => {
    expect(formatDate("2025-03-02")).toBe("March 2nd, 2025");
  });

  it("ordinal: 3rd", () => {
    expect(formatDate("2025-03-03")).toBe("March 3rd, 2025");
  });

  it("ordinal: 4th", () => {
    expect(formatDate("2025-03-04")).toBe("March 4th, 2025");
  });

  it("ordinal: 11th (exception)", () => {
    expect(formatDate("2025-03-11")).toBe("March 11th, 2025");
  });

  it("ordinal: 12th (exception)", () => {
    expect(formatDate("2025-03-12")).toBe("March 12th, 2025");
  });

  it("ordinal: 13th (exception)", () => {
    expect(formatDate("2025-03-13")).toBe("March 13th, 2025");
  });

  it("ordinal: 21st", () => {
    expect(formatDate("2025-03-21")).toBe("March 21st, 2025");
  });

  it("ordinal: 22nd", () => {
    expect(formatDate("2025-03-22")).toBe("March 22nd, 2025");
  });

  it("ordinal: 23rd", () => {
    expect(formatDate("2025-03-23")).toBe("March 23rd, 2025");
  });
});

describe("formatDateShort", () => {
  it("formats ISO to short month + ordinal day", () => {
    expect(formatDateShort("2025-01-15")).toBe("Jan 15th");
  });

  it("formats slash D/M/YYYY to short", () => {
    expect(formatDateShort("15/03/2025")).toBe("Mar 15th");
  });

  it("returns 'Unknown' for null", () => {
    expect(formatDateShort(null)).toBe("Unknown");
  });

  it("ordinal: 1st", () => {
    expect(formatDateShort("2025-06-01")).toBe("Jun 1st");
  });

  it("ordinal: 11th (exception)", () => {
    expect(formatDateShort("2025-06-11")).toBe("Jun 11th");
  });
});

describe("formatDateShort — fallback path", () => {
  it("parses ISO timestamp via fallback branch", () => {
    // "2025-01-15T00:00:00Z" does not match the dash or slash patterns
    expect(formatDateShort("2025-01-15T00:00:00Z")).toBe("Jan 15th");
  });

  it("returns 'Invalid date' for garbage input", () => {
    expect(formatDateShort("not-a-date")).toBe("Invalid date");
  });
});

describe("formatDateShortWithTime", () => {
  it("appends start time when provided", () => {
    expect(formatDateShortWithTime("2025-01-15", "7:30PM ET")).toBe("Jan 15th @ 7:30PM ET");
  });

  it("returns just the date when startTime is absent", () => {
    expect(formatDateShortWithTime("2025-01-15", null)).toBe("Jan 15th");
  });

  it("returns just the date when startTime is undefined", () => {
    expect(formatDateShortWithTime("2025-03-01")).toBe("Mar 1st");
  });
});

describe("formatDateWithTime", () => {
  it("appends start time when provided", () => {
    expect(formatDateWithTime("2025-01-15", "7:30PM ET")).toBe("January 15th, 2025 @ 7:30PM ET");
  });

  it("returns just the date when startTime is absent", () => {
    expect(formatDateWithTime("2025-01-15", null)).toBe("January 15th, 2025");
  });

  it("returns just the date when startTime is undefined", () => {
    expect(formatDateWithTime("2025-03-01")).toBe("March 1st, 2025");
  });
});

describe("parseUTC / toUTCDateString / addDays", () => {
  it("parseUTC returns a UTC midnight date", () => {
    const d = parseUTC("2025-01-15");
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(15);
  });

  it("toUTCDateString formats as YYYY-MM-DD", () => {
    const d = new Date(Date.UTC(2025, 0, 5));
    expect(toUTCDateString(d)).toBe("2025-01-05");
  });

  it("addDays adds days correctly", () => {
    expect(addDays("2025-01-15", 5)).toBe("2025-01-20");
  });

  it("addDays handles month crossover", () => {
    expect(addDays("2025-01-30", 3)).toBe("2025-02-02");
  });
});

describe("getPeriodLabel", () => {
  it("returns Q1-Q4 for NBA regular periods", () => {
    expect(getPeriodLabel(1, "nba")).toBe("Q1");
    expect(getPeriodLabel(2, "nba")).toBe("Q2");
    expect(getPeriodLabel(3, "nba")).toBe("Q3");
    expect(getPeriodLabel(4, "nba")).toBe("Q4");
  });

  it("returns OT for NBA overtime (period 5)", () => {
    expect(getPeriodLabel(5, "nba")).toBe("OT");
  });

  it("returns OT2 for NBA double overtime (period 6)", () => {
    expect(getPeriodLabel(6, "nba")).toBe("OT2");
  });

  it("returns Q1-Q4 for NFL periods", () => {
    expect(getPeriodLabel(1, "nfl")).toBe("Q1");
    expect(getPeriodLabel(4, "nfl")).toBe("Q4");
  });

  it("returns OT for NFL overtime", () => {
    expect(getPeriodLabel(5, "nfl")).toBe("OT");
  });

  it("returns P1-P3 for NHL regular periods", () => {
    expect(getPeriodLabel(1, "nhl")).toBe("P1");
    expect(getPeriodLabel(2, "nhl")).toBe("P2");
    expect(getPeriodLabel(3, "nhl")).toBe("P3");
  });

  it("returns OT for NHL overtime (period 4)", () => {
    expect(getPeriodLabel(4, "nhl")).toBe("OT");
  });

  it("returns OT2 for NHL double OT (period 5)", () => {
    expect(getPeriodLabel(5, "nhl")).toBe("OT2");
  });

  it("returns empty string for null period", () => {
    expect(getPeriodLabel(null, "nba")).toBe("");
  });

  it("returns empty string for undefined period", () => {
    expect(getPeriodLabel(undefined, "nba")).toBe("");
  });
});
