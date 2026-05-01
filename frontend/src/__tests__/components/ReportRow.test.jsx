// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportRow from "../../components/reports/ReportRow.jsx";

function inRouter(ui) {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

const player = {
  id: 1, name: "Bones Hyland", slug: "bones-hyland", imageUrl: null, league: "nba",
};

describe("ReportRow", () => {
  it("renders an InjuryReportRow for type=injury", () => {
    const r = {
      id: "i1", type: "injury", date: "2026-04-30T18:00:00Z", league: "nba", player,
      prevStatus: "questionable", newStatus: "active", newStatusDescription: null,
    };
    render(inRouter(<ReportRow report={r} />));
    expect(screen.getByText("Bones Hyland")).toBeInTheDocument();
    expect(screen.getByText(/questionable/i)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("renders a MoveReportRow with NR badge when fromTeam is null", () => {
    const r = {
      id: "m1", type: "move", date: "2026-04-12T07:00:00Z", league: "nba", player,
      action: "sign", fromTeam: null,
      toTeam: { id: 17, abbreviation: "BKN", name: "Brooklyn Nets", logoUrl: "x.png" },
    };
    render(inRouter(<ReportRow report={r} />));
    expect(screen.getByLabelText("Not on Roster")).toBeInTheDocument();
    expect(screen.getByAltText("Brooklyn Nets")).toBeInTheDocument();
  });

  it("renders a BirthdayReportRow with the age", () => {
    const r = {
      id: "b1", type: "birthday", date: "2026-04-30T00:00:00Z", league: "nba", player, age: 24,
    };
    render(inRouter(<ReportRow report={r} />));
    expect(screen.getByText(/Happy 24th Birthday/)).toBeInTheDocument();
  });

  it("renders a StreakReportRow with the streak length and label", () => {
    const r = {
      id: "s1", type: "streak", date: "2026-04-30T22:00:00Z", league: "nba", player,
      streakLength: 5, statLabel: "double-double", emoji: "🔥",
    };
    render(inRouter(<ReportRow report={r} />));
    expect(screen.getByText(/5-game double-double streak/)).toBeInTheDocument();
  });

  it("renders a team win streak with logo and league-team link", () => {
    const team = {
      id: 13, name: "Nuggets", location: "Denver", shortname: "DEN",
      abbreviation: "DEN", logoUrl: "https://espn.com/den.png", league: "nba",
    };
    const r = {
      id: "streak-team-13-win-2026-04-20",
      type: "streak",
      date: "2026-04-29T22:00:00Z",
      league: "nba",
      team,
      streakLength: 5,
      statLabel: "win",
      emoji: "🔥",
    };
    render(inRouter(<ReportRow report={r} />));
    expect(screen.getByText(/5-game win streak/)).toBeInTheDocument();
    expect(screen.getByAltText("Nuggets")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/nba/teams/den");
  });

  it("renders a team loss streak with snowflake emoji", () => {
    const team = {
      id: 7, name: "Wizards", location: "Washington", shortname: "WAS",
      abbreviation: "WAS", logoUrl: null, league: "nba",
    };
    const r = {
      id: "streak-team-7-loss-2026-04-22",
      type: "streak",
      date: "2026-04-29T22:00:00Z",
      league: "nba",
      team,
      streakLength: 4,
      statLabel: "loss",
      emoji: "❄️",
    };
    render(inRouter(<ReportRow report={r} />));
    expect(screen.getByText(/4-game loss streak/)).toBeInTheDocument();
  });

  it("falls back to initials when imageUrl is null", () => {
    const r = {
      id: "i1", type: "injury", date: "2026-04-30T18:00:00Z", league: "nba", player,
      prevStatus: "questionable", newStatus: "active", newStatusDescription: null,
    };
    render(inRouter(<ReportRow report={r} />));
    expect(screen.getByText("BH")).toBeInTheDocument();
  });
});
