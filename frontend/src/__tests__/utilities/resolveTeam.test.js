import { describe, it, expect } from "vitest";
import resolveTeam from "../../utils/resolveTeam.js";

const lakers = { id: 17, name: "Los Angeles Lakers", shortname: "Lakers", abbreviation: "LAL" };
const warriors = { id: 2, name: "Golden State Warriors", shortname: "Warriors", abbreviation: "GS" };
const teamList = [lakers, warriors];

describe("resolveTeam", () => {
  it("matches by lowercase abbreviation", () => {
    expect(resolveTeam(teamList, "lal")).toBe(lakers);
  });

  it("matches abbreviation case-insensitively", () => {
    expect(resolveTeam(teamList, "LAL")).toBe(lakers);
  });

  it("falls back to name slug", () => {
    expect(resolveTeam(teamList, "los-angeles-lakers")).toBe(lakers);
  });

  it("falls back to shortname slug", () => {
    expect(resolveTeam(teamList, "lakers")).toBe(lakers);
  });

  it("returns null when no match", () => {
    expect(resolveTeam(teamList, "nonexistent")).toBeNull();
  });

  it("tolerates null/empty param", () => {
    expect(resolveTeam(teamList, null)).toBeNull();
    expect(resolveTeam(teamList, "")).toBeNull();
  });

  it("tolerates null abbreviation on a team row", () => {
    const list = [{ id: 1, name: "Foo", shortname: "Foo", abbreviation: null }];
    expect(resolveTeam(list, "foo")).toBe(list[0]);
  });
});
