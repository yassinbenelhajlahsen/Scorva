import { describe, it, expect } from "@jest/globals";
import { DateTime } from "luxon";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { tryParseDate } = await import(resolve(__dirname, "../../src/utils/dateParser.js"));

// Compute expected season years so tests are date-agnostic
const now = DateTime.now().setZone("utc");
const startYear = now.month >= 7 ? now.year : now.year - 1;
const endYear = startYear + 1;

describe("tryParseDate", () => {
  describe("early exits", () => {
    it("returns null for empty string", () => {
      expect(tryParseDate("")).toBeNull();
    });

    it("returns null for strings shorter than 4 chars", () => {
      expect(tryParseDate("Jan")).toBeNull();
      expect(tryParseDate("1/5")).toBeNull();
      expect(tryParseDate("abc")).toBeNull();
    });

    it("returns null for a bare 4-digit year", () => {
      expect(tryParseDate("2025")).toBeNull();
      expect(tryParseDate("2024")).toBeNull();
    });

    it("returns null for an unrecognized string", () => {
      expect(tryParseDate("foobar")).toBeNull();
      expect(tryParseDate("hello world")).toBeNull();
    });
  });

  describe("full date formats", () => {
    it("parses yyyy-M-d format", () => {
      expect(tryParseDate("2025-1-5")).toBe("2025-01-05");
      expect(tryParseDate("2025-12-31")).toBe("2025-12-31");
    });

    it("parses M/d/yyyy format", () => {
      expect(tryParseDate("1/5/2025")).toBe("2025-01-05");
      expect(tryParseDate("12/25/2024")).toBe("2024-12-25");
    });

    it("parses M-d-yyyy format", () => {
      expect(tryParseDate("1-5-2025")).toBe("2025-01-05");
      expect(tryParseDate("11-3-2024")).toBe("2024-11-03");
    });

    it("parses MMM d yyyy format", () => {
      expect(tryParseDate("Jan 5 2025")).toBe("2025-01-05");
      expect(tryParseDate("Dec 25 2024")).toBe("2024-12-25");
    });

    it("parses MMM d, yyyy format", () => {
      expect(tryParseDate("Jan 5, 2025")).toBe("2025-01-05");
      expect(tryParseDate("Oct 15, 2024")).toBe("2024-10-15");
    });

    it("parses MMMM d yyyy format", () => {
      expect(tryParseDate("January 5 2025")).toBe("2025-01-05");
      expect(tryParseDate("December 25 2024")).toBe("2024-12-25");
    });

    it("parses MMMM d, yyyy format", () => {
      expect(tryParseDate("January 5, 2025")).toBe("2025-01-05");
      expect(tryParseDate("October 15, 2024")).toBe("2024-10-15");
    });
  });

  describe("partial date formats (season-aware year inference)", () => {
    it("infers end year (< July) for M/d slash format", () => {
      // January 15 (month 1) < 7 → endYear; "1/15" is 4 chars, clears the length < 4 guard
      expect(tryParseDate("1/15")).toBe(`${endYear}-01-15`);
    });

    it("infers start year (>= July) for M/d slash format", () => {
      // October (month 10) >= 7 → startYear
      expect(tryParseDate("10/15")).toBe(`${startYear}-10-15`);
    });

    it("infers end year for M-d dash format", () => {
      expect(tryParseDate("2-14")).toBe(`${endYear}-02-14`);
    });

    it("infers start year for October dash format", () => {
      expect(tryParseDate("11-3")).toBe(`${startYear}-11-03`);
    });

    it("infers end year for MMM d format", () => {
      // March (month 3) < 7 → endYear
      expect(tryParseDate("Mar 10")).toBe(`${endYear}-03-10`);
    });

    it("infers start year for October MMM d format", () => {
      expect(tryParseDate("Oct 15")).toBe(`${startYear}-10-15`);
    });

    it("handles MMM d, format (trailing comma)", () => {
      expect(tryParseDate("Jan 5,")).toBe(`${endYear}-01-05`);
    });

    it("infers end year for MMMM d format", () => {
      expect(tryParseDate("January 5")).toBe(`${endYear}-01-05`);
    });

    it("infers start year for full month October format", () => {
      expect(tryParseDate("October 15")).toBe(`${startYear}-10-15`);
    });

    it("infers end year for February full month", () => {
      expect(tryParseDate("February 28")).toBe(`${endYear}-02-28`);
    });
  });
});
