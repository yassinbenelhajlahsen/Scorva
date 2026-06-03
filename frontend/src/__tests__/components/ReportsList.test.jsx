// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportsList from "../../components/reports/ReportsList.jsx";

const player = { id: 1, name: "X Y", slug: "x-y", imageUrl: null, league: "nba" };

function inRouter(ui) {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

describe("ReportsList", () => {
  it("renders nothing when reports is empty and not loading", () => {
    const { container } = render(inRouter(<ReportsList reports={[]} />));
    expect(container.firstChild).toBeNull();
  });

  it("renders a row per report with no headers when groupByDate=false", () => {
    const reports = [
      { id: "i1", type: "injury", date: "2026-04-30T00:00:00Z", league: "nba", player, prevStatus: null, newStatus: "out" },
      { id: "i2", type: "injury", date: "2026-04-29T00:00:00Z", league: "nba", player, prevStatus: null, newStatus: "out" },
    ];
    render(inRouter(<ReportsList reports={reports} groupByDate={false} />));
    // Date group headers always include the year (e.g. "Apr 30, 2026"); row
    // timestamps never do. Asserting the header text is absent is timezone-safe.
    expect(screen.queryByText(/Apr 30, 2026/i)).not.toBeInTheDocument();
  });

  it("renders date headers when groupByDate=true", () => {
    const reports = [
      { id: "i1", type: "injury", date: "2026-04-30T18:00:00Z", league: "nba", player, prevStatus: null, newStatus: "out" },
      { id: "i2", type: "injury", date: "2026-04-29T12:00:00Z", league: "nba", player, prevStatus: null, newStatus: "out" },
    ];
    render(inRouter(<ReportsList reports={reports} groupByDate={true} />));
    expect(screen.getByText(/Apr 30, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Apr 29, 2026/i)).toBeInTheDocument();
  });

  it("renders skeletons when loading", () => {
    const { container } = render(inRouter(<ReportsList reports={[]} loading={true} skeletonCount={3} />));
    expect(container.querySelectorAll('[data-testid="report-skeleton"]')).toHaveLength(3);
  });
});
