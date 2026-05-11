// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TeamHighlightsTab from "../../components/team/TeamHighlightsTab.jsx";

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";

const wrap = (ui) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
};

beforeEach(() => { vi.clearAllMocks(); });

describe("TeamHighlightsTab", () => {
  test("calls useTopPerformances with entity=team and teamId", () => {
    useTopPerformances.mockReturnValue({ data: { performances: [] }, isLoading: false });
    wrap(<TeamHighlightsTab team={{ id: 13, name: "Lakers" }} league="nba" />);
    expect(useTopPerformances).toHaveBeenCalledWith("nba", expect.objectContaining({
      entity: "team",
      teamId: 13,
      type: "performances",
    }));
  });

  test("renders empty state when no performances", () => {
    useTopPerformances.mockReturnValue({ data: { performances: [] }, isLoading: false });
    wrap(<TeamHighlightsTab team={{ id: 13, name: "Lakers" }} league="nba" />);
    expect(screen.getByText(/no performances/i)).toBeInTheDocument();
  });

  test("changing window dropdown re-calls hook with new window", () => {
    useTopPerformances.mockReturnValue({ data: { performances: [] }, isLoading: false });
    wrap(<TeamHighlightsTab team={{ id: 13, name: "Lakers" }} league="nba" />);
    fireEvent.change(screen.getByLabelText(/window/i), { target: { value: "season" } });
    const lastCall = useTopPerformances.mock.calls.at(-1);
    expect(lastCall[1].window).toBe("season");
  });
});
