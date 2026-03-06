import { describe, it, expect } from "vitest";
import formatDate, { formatDateShort } from "../../utilities/formatDate.js";

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
