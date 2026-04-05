import { describe, it, expect } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { default: pgDateToString } = await import(
  resolve(__dirname, "../../src/utils/pgDateToString.js")
);

describe("pgDateToString", () => {
  it("formats a Date object to YYYY-MM-DD", () => {
    expect(pgDateToString(new Date("2025-01-15T00:00:00.000Z"))).toBe("2025-01-15");
  });

  it("formats a PG ISO timestamp string to YYYY-MM-DD", () => {
    expect(pgDateToString("2025-01-15T00:00:00.000Z")).toBe("2025-01-15");
  });

  it("zero-pads single-digit month and day", () => {
    expect(pgDateToString(new Date("2025-03-05T00:00:00.000Z"))).toBe("2025-03-05");
    expect(pgDateToString(new Date("2025-09-01T00:00:00.000Z"))).toBe("2025-09-01");
  });

  it("handles December 31 correctly", () => {
    expect(pgDateToString(new Date("2024-12-31T00:00:00.000Z"))).toBe("2024-12-31");
  });

  it("handles January 1 correctly (year boundary)", () => {
    expect(pgDateToString(new Date("2025-01-01T00:00:00.000Z"))).toBe("2025-01-01");
  });

  it("uses UTC date, not local timezone", () => {
    // UTC midnight on Jan 15 should always be 2025-01-15 regardless of local timezone
    const result = pgDateToString("2025-01-15T00:00:00.000Z");
    expect(result).toBe("2025-01-15");
  });

  it("handles end-of-month dates", () => {
    expect(pgDateToString(new Date("2025-02-28T00:00:00.000Z"))).toBe("2025-02-28");
    expect(pgDateToString(new Date("2025-03-31T00:00:00.000Z"))).toBe("2025-03-31");
  });
});
