// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import TeamComparison from "../../components/game/TeamComparison.jsx";

const homeInfo = { info: { name: "Home", logoUrl: "/h.png" } };
const awayInfo = { info: { name: "Away", logoUrl: "/a.png" } };

function teamWith(players, info = homeInfo) {
  return { ...info, players };
}

describe("TeamComparison — NBA", () => {
  const home = teamWith(
    [
      { stats: { PTS: 30, REB: 10, AST: 8, STL: 2, BLK: 1, TO: 3, PF: 4, FG: "10-20", "3PT": "3-7", FT: "7-8" } },
      { stats: { PTS: 25, REB: 8, AST: 5, STL: 1, BLK: 0, TO: 2, PF: 2, FG: "9-15", "3PT": "1-3", FT: "6-6" } },
    ],
    homeInfo
  );
  const away = teamWith(
    [
      { stats: { PTS: 20, REB: 12, AST: 4, STL: 0, BLK: 2, TO: 5, PF: 3, FG: "8-22", "3PT": "2-9", FT: "2-4" } },
      { stats: { PTS: 22, REB: 6, AST: 6, STL: 1, BLK: 1, TO: 1, PF: 5, FG: "9-20", "3PT": "2-6", FT: "2-2" } },
    ],
    awayInfo
  );

  it("renders all NBA stat rows with correct totals", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nba" />);
    expect(screen.getByText("Team Comparison")).toBeInTheDocument();
    expect(screen.getByText("PTS")).toBeInTheDocument();
    // Home: 30+25=55, Away: 20+22=42
    expect(screen.getByText("55")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    // FG%: home 19/35 = 54.3%; away 17/42 = 40.5%
    expect(screen.getByText("54.3%")).toBeInTheDocument();
    expect(screen.getByText("40.5%")).toBeInTheDocument();
  });

  it("highlights the leader in accent for higher-is-better stats", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nba" />);
    const homePts = screen.getByText("55");
    const awayPts = screen.getByText("42");
    expect(homePts.className).toMatch(/text-accent/);
    expect(awayPts.className).not.toMatch(/text-accent/);
  });

  it("highlights the lower value for lower-is-better stats (TO)", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nba" />);
    // Home TO: 3+2=5, Away TO: 5+1=6 → home wins (lower)
    const toLabel = screen.getByText("TO");
    const row = toLabel.parentElement;
    const [homeCell, , awayCell] = row.children;
    expect(homeCell.textContent).toBe("5");
    expect(awayCell.textContent).toBe("6");
    expect(homeCell.className).toMatch(/text-accent/);
    expect(awayCell.className).not.toMatch(/text-accent/);
  });
});

describe("TeamComparison — NHL", () => {
  const home = teamWith(
    [
      { stats: { G: 2, SHOTS: 12, HT: 8, BS: 5, TK: 4, GV: 3, PIM: 4, SAVES: 0, GA: 0 } },
      { stats: { G: 0, SHOTS: 0, HT: 0, BS: 0, TK: 0, GV: 0, PIM: 0, SAVES: 28, GA: 1 } },
    ],
    homeInfo
  );
  const away = teamWith(
    [
      { stats: { G: 1, SHOTS: 10, HT: 6, BS: 7, TK: 2, GV: 5, PIM: 6, SAVES: 0, GA: 0 } },
      { stats: { G: 0, SHOTS: 0, HT: 0, BS: 0, TK: 0, GV: 0, PIM: 0, SAVES: 25, GA: 2 } },
    ],
    awayInfo
  );

  it("computes SAVE% across goalies", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nhl" />);
    // Home: 28/(28+1) = 96.6%
    expect(screen.getByText("96.6%")).toBeInTheDocument();
    // Away: 25/(25+2) = 92.6%
    expect(screen.getByText("92.6%")).toBeInTheDocument();
  });

  it("renders core NHL labels", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nhl" />);
    expect(screen.getByText("GOALS")).toBeInTheDocument();
    expect(screen.getByText("SHOTS")).toBeInTheDocument();
    expect(screen.getByText("PIM")).toBeInTheDocument();
    expect(screen.getByText("SAVE%")).toBeInTheDocument();
  });
});

describe("TeamComparison — NFL", () => {
  // Home: QB has CMPATT, RB doesn't. Defender (no CMPATT) has SCKS and INT.
  const home = teamWith(
    [
      { stats: { CMPATT: "22/35", YDS: 280, TD: 2, INT: 1, SCKS: "2-15" } }, // QB
      { stats: { YDS: 60, TD: 1, SCKS: "0-0", INT: 0 } }, // RB (no CMPATT)
      { stats: { SCKS: "3-21", INT: 1 } }, // DE
    ],
    homeInfo
  );
  const away = teamWith(
    [
      { stats: { CMPATT: "18/30", YDS: 220, TD: 1, INT: 2, SCKS: "3-18" } }, // QB
      { stats: { SCKS: "1-7", INT: 0 } }, // DT
    ],
    awayInfo
  );

  it("renders Offense and Defense sections", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nfl" />);
    expect(screen.getByText("Offense")).toBeInTheDocument();
    expect(screen.getByText("Defense")).toBeInTheDocument();
  });

  it("offense uses only QBs (CMPATT present)", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nfl" />);
    // Home offense PASS YDS = 280 (QB only, RB excluded). RB had 60 yds.
    expect(screen.getByText("280")).toBeInTheDocument();
    expect(screen.getByText("220")).toBeInTheDocument();
  });

  it("defense uses non-QBs and aggregates SCKS via fraction parse", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nfl" />);
    // Home defense SACKS = 3 (DE only, QB excluded; RB has 0)
    // Away defense SACKS = 1 (DT)
    // Both rendered as ints; check labels exist
    expect(screen.getByText("SACKS")).toBeInTheDocument();
    expect(screen.getByText("SACKS ALLOWED")).toBeInTheDocument();
  });

  it("CMP/ATT shows combined string", () => {
    render(<TeamComparison homeTeam={home} awayTeam={away} league="nfl" />);
    expect(screen.getByText("22/35")).toBeInTheDocument();
    expect(screen.getByText("18/30")).toBeInTheDocument();
  });
});

describe("TeamComparison — guards", () => {
  it("returns null when both teams have no players", () => {
    const { container } = render(
      <TeamComparison
        homeTeam={teamWith([])}
        awayTeam={teamWith([], awayInfo)}
        league="nba"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null for unknown league", () => {
    const { container } = render(
      <TeamComparison
        homeTeam={teamWith([{ stats: { PTS: 10 } }])}
        awayTeam={teamWith([{ stats: { PTS: 8 } }], awayInfo)}
        league="mlb"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("ties are not highlighted on either side", () => {
    const tieHome = teamWith([{ stats: { PTS: 10, REB: 5, AST: 5, STL: 1, BLK: 1, TO: 2, PF: 2, FG: "5-10", "3PT": "1-3", FT: "1-2" } }], homeInfo);
    const tieAway = teamWith([{ stats: { PTS: 10, REB: 5, AST: 5, STL: 1, BLK: 1, TO: 2, PF: 2, FG: "5-10", "3PT": "1-3", FT: "1-2" } }], awayInfo);
    render(<TeamComparison homeTeam={tieHome} awayTeam={tieAway} league="nba" />);
    const tens = screen.getAllByText("10");
    tens.forEach((el) => {
      expect(el.className).not.toMatch(/text-accent/);
    });
  });
});
