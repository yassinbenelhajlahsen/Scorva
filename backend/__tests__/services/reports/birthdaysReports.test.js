import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPoolQuery = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../../src/db/db.js"), () => ({
  default: { query: mockPoolQuery },
}));

const { getBirthdaysForLeague } = await import(
  resolve(__dirname, "../../../src/services/reports/birthdaysReports.js")
);

describe("getBirthdaysForLeague", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps rows into birthday reports with computed age and date", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{
        player_id: 4567,
        player_name: "Jordan Hawkins",
        player_image: "https://espn.com/x.png",
        dob: "29/4/2002",
        bday_date: new Date("2026-04-29T00:00:00Z"),
        age: 24,
      }],
    });

    const out = await getBirthdaysForLeague("nba");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "birthday-4567-2026-04-29",
      type: "birthday",
      league: "nba",
      age: 24,
      player: {
        id: 4567,
        name: "Jordan Hawkins",
        slug: "jordan-hawkins",
        imageUrl: "https://espn.com/x.png",
        league: "nba",
      },
    });
  });

  it("filters to popularity > 0 and last 30 days via SQL", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    await getBirthdaysForLeague("nba");
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(/popularity\s*>\s*0/);
    expect(params).toEqual(["nba"]);
  });

  it("returns [] on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("db"));
    const out = await getBirthdaysForLeague("nba");
    expect(out).toEqual([]);
  });
});
