import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../hooks/data/useSeasons.js", () => ({ useSeasons: vi.fn() }));

const { useSeasons } = await import("../../hooks/data/useSeasons.js");
const SeasonSelector = (await import("../../components/navigation/SeasonSelector.jsx")).default;

beforeEach(() => {
  vi.clearAllMocks();
  useSeasons.mockReturnValue({ seasons: ["2024-25", "2023-24", "2022-23"] });
});

describe("SeasonSelector", () => {
  it("renders a placeholder skeleton when seasons are loading (empty)", () => {
    useSeasons.mockReturnValue({ seasons: [] });
    render(
      <SeasonSelector
        league="nba"
        selectedSeason="2024-25"
        onSeasonChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders select with seasons from hook", () => {
    render(
      <SeasonSelector
        league="nba"
        selectedSeason="2024-25"
        onSeasonChange={vi.fn()}
      />
    );
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("2024-25")).toBeInTheDocument();
    expect(screen.getByText("2023-24")).toBeInTheDocument();
  });

  it("uses override seasons prop instead of hook when provided", () => {
    render(
      <SeasonSelector
        league="nba"
        selectedSeason="2025-26"
        onSeasonChange={vi.fn()}
        seasons={["2025-26", "2024-25"]}
      />
    );
    expect(screen.getByText("2025-26")).toBeInTheDocument();
    // Hook's extra season should not appear if fully overridden
    expect(screen.queryByText("2022-23")).not.toBeInTheDocument();
  });

  it("shows selected season as current value", () => {
    render(
      <SeasonSelector
        league="nba"
        selectedSeason="2023-24"
        onSeasonChange={vi.fn()}
      />
    );
    expect(screen.getByRole("combobox").value).toBe("2023-24");
  });

  it("calls onSeasonChange when selection changes", () => {
    const onSeasonChange = vi.fn();
    render(
      <SeasonSelector
        league="nba"
        selectedSeason="2024-25"
        onSeasonChange={onSeasonChange}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2023-24" } });
    expect(onSeasonChange).toHaveBeenCalledWith("2023-24");
  });

  it("passes league to useSeasons hook", () => {
    render(
      <SeasonSelector
        league="nfl"
        selectedSeason="2024"
        onSeasonChange={vi.fn()}
      />
    );
    expect(useSeasons).toHaveBeenCalledWith("nfl");
  });
});
