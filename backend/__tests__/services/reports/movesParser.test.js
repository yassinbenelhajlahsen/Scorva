import { describe, it, expect } from "@jest/globals";
import {
  classifyAction,
  isAhlOnly,
  isOptionExercise,
  extractPlayerNames,
  parseMove,
} from "../../../src/services/reports/movesParser.js";

describe("classifyAction", () => {
  it("classifies sign / re-sign / convert as 'sign'", () => {
    expect(classifyAction("Signed F Trevon Scott to a 10-day contract.")).toBe("sign");
    expect(classifyAction("Re-signed G Nick Smith Jr. to a contract.")).toBe("sign");
    expect(classifyAction("Converted the contract of G A.J. Lawson to an NBA contract.")).toBe("sign");
  });

  it("classifies waive / release / waive-injured as 'waive'", () => {
    expect(classifyAction("Waived G Tyreke Key.")).toBe("waive");
    expect(classifyAction("Released RB Elijah Mitchell.")).toBe("waive");
    expect(classifyAction("Waived/injured T Jack Wilson.")).toBe("waive");
  });

  it("classifies trade as 'trade'", () => {
    expect(classifyAction("Traded F Foo to Bar for G Baz.")).toBe("trade");
    expect(classifyAction("Acquired G Eric Bledsoe from the Clippers.")).toBe("trade");
  });

  it("returns null for coach / front-office moves (filtered out in v1)", () => {
    expect(classifyAction("Announced the resignation of head coach Billy Donovan.")).toBeNull();
    expect(classifyAction("Fired executive vice president Arturas Karnisovas.")).toBeNull();
    expect(classifyAction("Named John Doe head coach.")).toBeNull();
  });

  it("classifies multi-clause descriptions by their first verb", () => {
    expect(classifyAction("Re-signed F Tolu might to a rest-of-season contract. Waived F Bobi Klintman."))
      .toBe("sign");
  });
});

describe("isAhlOnly", () => {
  it("matches descriptions ending in (AHL).", () => {
    expect(isAhlOnly("Assigned G Joel Blomqvist to Wilkes-Barre/Scranton (AHL).")).toBe(true);
    expect(isAhlOnly("Recalled D Charles-Alexis Legault from Chicago (AHL).")).toBe(true);
  });
  it("rejects non-AHL moves", () => {
    expect(isAhlOnly("Signed F Trevon Scott to a 10-day contract.")).toBe(false);
  });
});

describe("isOptionExercise", () => {
  it("matches fifth-year / contract option exercises", () => {
    expect(isOptionExercise("Exercised the fifth-year option on DE Will McDonald IV.")).toBe(true);
    expect(isOptionExercise("Exercised the team option on F Sample Player.")).toBe(true);
  });
  it("rejects non-option moves", () => {
    expect(isOptionExercise("Signed F Trevon Scott to a 10-day contract.")).toBe(false);
  });
});

describe("extractPlayerNames", () => {
  const players = new Map([
    ["trevon scott", { id: 4234, name: "Trevon Scott" }],
    ["nick smith jr.", { id: 5001, name: "Nick Smith Jr." }],
    ["a.j. lawson", { id: 5002, name: "A.J. Lawson" }],
    ["dalano banton", { id: 5003, name: "Dalano Banton" }],
    ["bobi klintman", { id: 5004, name: "Bobi Klintman" }],
    ["tolu might", { id: 5005, name: "Tolu might" }],
    ["ali gaye", { id: 5006, name: "Ali Gaye" }],
    ["nate lynn", { id: 5007, name: "Nate Lynn" }],
  ]);

  it("extracts a single player after a position prefix", () => {
    const out = extractPlayerNames("Signed F Trevon Scott to a 10-day contract.", players);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 4234, name: "Trevon Scott" });
  });

  it("extracts multiple players from one description", () => {
    const out = extractPlayerNames(
      "Waived DEs Ali Gaye and Nate Lynn, DL Isaiah Raikes.",
      players
    );
    const names = out.map((p) => p.name);
    expect(names).toContain("Ali Gaye");
    expect(names).toContain("Nate Lynn");
  });

  it("extracts players from each clause of a multi-action description", () => {
    const out = extractPlayerNames(
      "Re-signed F Tolu might to a rest-of-season contract. Waived F Bobi Klintman.",
      players
    );
    const names = out.map((p) => p.name);
    expect(names).toContain("Tolu might");
    expect(names).toContain("Bobi Klintman");
  });

  it("ignores names not found in the players map", () => {
    const out = extractPlayerNames("Signed F Some Unknown to a 10-day contract.", players);
    expect(out).toHaveLength(0);
  });

  it("handles the 'A.J.' style with periods", () => {
    const out = extractPlayerNames(
      "Converted the contract of G A.J. Lawson to an NBA contract.",
      players
    );
    expect(out[0]).toMatchObject({ name: "A.J. Lawson" });
  });

  it("returns [] for null / empty inputs", () => {
    const map = new Map([["john doe", { id: 1, name: "John Doe" }]]);
    expect(extractPlayerNames(null, map)).toEqual([]);
    expect(extractPlayerNames("", map)).toEqual([]);
    expect(extractPlayerNames("Signed F John Doe", null)).toEqual([]);
  });
});

describe("parseMove", () => {
  const players = new Map([
    ["trevon scott", { id: 4234, name: "Trevon Scott" }],
    ["dalano banton", { id: 5003, name: "Dalano Banton" }],
    ["tyreke key", { id: 5008, name: "Tyreke Key" }],
  ]);
  const team = { id: 17, abbreviation: "BKN", name: "Brooklyn Nets", logoUrl: "x.png" };

  it("returns null for AHL-only moves", () => {
    const out = parseMove({
      description: "Assigned G Joel Blomqvist to Wilkes-Barre/Scranton (AHL).",
      team, players,
    });
    expect(out).toBeNull();
  });

  it("returns null for option-exercise moves", () => {
    const out = parseMove({
      description: "Exercised the fifth-year option on DE Will McDonald IV.",
      team, players,
    });
    expect(out).toBeNull();
  });

  it("returns null for coach moves (v1 filter)", () => {
    const out = parseMove({
      description: "Announced the resignation of head coach Billy Donovan.",
      team, players,
    });
    expect(out).toBeNull();
  });

  it("for a sign: fromTeam=null, toTeam=announcing team", () => {
    const out = parseMove({
      description: "Signed F Trevon Scott to a 10-day contract.",
      team, players,
    });
    expect(out).toEqual([{
      action: "sign",
      fromTeam: null,
      toTeam: team,
      player: { id: 4234, name: "Trevon Scott" },
    }]);
  });

  it("for a waive: fromTeam=announcing team, toTeam=null", () => {
    const out = parseMove({
      description: "Waived G Tyreke Key.",
      team, players,
    });
    expect(out).toEqual([{
      action: "waive",
      fromTeam: team,
      toTeam: null,
      player: { id: 5008, name: "Tyreke Key" },
    }]);
  });

  const lakers = { id: 21, abbreviation: "LAL", name: "Los Angeles Lakers", logoUrl: "lal.png" };
  const hawks = { id: 22, abbreviation: "ATL", name: "Atlanta Hawks", logoUrl: "atl.png" };
  const teamsByName = new Map([
    ["los angeles lakers", lakers],
    ["lakers", lakers],
    ["los angeles", lakers],
    ["atlanta hawks", hawks],
    ["hawks", hawks],
    ["atlanta", hawks],
    ["brooklyn nets", team],
    ["nets", team],
    ["brooklyn", team],
  ]);

  it("for 'Traded ... to {Team}': fromTeam=announcing, toTeam parsed from description", () => {
    const out = parseMove({
      description: "Traded F Trevon Scott to the Lakers for cash considerations.",
      team, players, teamsByName,
    });
    expect(out).toEqual([{
      action: "trade",
      fromTeam: team,
      toTeam: lakers,
      player: { id: 4234, name: "Trevon Scott" },
    }]);
  });

  it("for 'Acquired ... from {Team}': toTeam=announcing, fromTeam parsed from description", () => {
    const acquiringTeam = lakers;
    const players2 = new Map([["luke kennard", { id: 9001, name: "Luke Kennard" }]]);
    const out = parseMove({
      description: "Acquired G Luke Kennard from the Atlanta Hawks.",
      team: acquiringTeam, players: players2, teamsByName,
    });
    expect(out).toEqual([{
      action: "trade",
      fromTeam: hawks,
      toTeam: acquiringTeam,
      player: { id: 9001, name: "Luke Kennard" },
    }]);
  });

  it("multi-clause 'Acquired X from {team} for Y': X and Y go opposite directions", () => {
    // Real ESPN Hawks-side description from the 2026-02-05 Kennard/Vincent trade.
    const players2 = new Map([
      ["gabe vincent", { id: 7001, name: "Gabe Vincent" }],
      ["luke kennard", { id: 7002, name: "Luke Kennard" }],
    ]);
    const out = parseMove({
      description:
        "Acquired G Gabe Vincent and a 2032 second-round pick from Los Angeles Lakers for G Luke Kennard.",
      team: hawks, players: players2, teamsByName,
    });
    const byName = Object.fromEntries(out.map((m) => [m.player.name, m]));
    expect(byName["Gabe Vincent"]).toMatchObject({ fromTeam: lakers, toTeam: hawks });
    expect(byName["Luke Kennard"]).toMatchObject({ fromTeam: hawks, toTeam: lakers });
  });

  it("multi-clause 'Traded X to {team} for Y': X goes out, Y comes in", () => {
    const players2 = new Map([
      ["alpha one", { id: 8001, name: "Alpha One" }],
      ["bravo two", { id: 8002, name: "Bravo Two" }],
    ]);
    const out = parseMove({
      description: "Traded F Alpha One to the Lakers for G Bravo Two.",
      team, players: players2, teamsByName,
    });
    const byName = Object.fromEntries(out.map((m) => [m.player.name, m]));
    expect(byName["Alpha One"]).toMatchObject({ fromTeam: team, toTeam: lakers });
    expect(byName["Bravo Two"]).toMatchObject({ fromTeam: lakers, toTeam: team });
  });

  it("for a trade with no resolvable partner team: fromTeam=announcing, toTeam=null", () => {
    const out = parseMove({
      description: "Traded F Trevon Scott for cash considerations.",
      team, players, teamsByName,
    });
    expect(out).toEqual([{
      action: "trade",
      fromTeam: team,
      toTeam: null,
      player: { id: 4234, name: "Trevon Scott" },
    }]);
  });

  it("returns one entry per resolved player when description has multiple", () => {
    const out = parseMove({
      description: "Signed F Trevon Scott and F Dalano Banton to 10-day contracts.",
      team, players,
    });
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.player.name)).toEqual(["Trevon Scott", "Dalano Banton"]);
  });
});
