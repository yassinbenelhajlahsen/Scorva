import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../components/ui/DateStrip.jsx", () => ({
  default: (props) => (
    <div
      data-testid="date-strip"
      data-selected={props.selectedDate}
      data-gamedates={JSON.stringify(props.gameDates)}
      data-gamecounts={JSON.stringify(props.gameCounts ? Object.fromEntries(props.gameCounts) : null)}
    />
  ),
}));

vi.mock("../../components/ui/CalendarPopup.jsx", () => ({
  default: (props) =>
    props.isOpen ? <div data-testid="calendar-popup" /> : null,
}));

const DateNavigation = (await import("../../components/ui/DateNavigation.jsx")).default;

// Pin today to 2025-06-15 (Sunday)
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-06-15T16:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const GAME_DATES = ["2025-06-10", "2025-06-15", "2025-06-20"];
const GAME_COUNTS = new Map(GAME_DATES.map((d, i) => [d, i + 2]));

function renderNav(props = {}) {
  const defaults = {
    selectedDate: null,
    onDateChange: vi.fn(),
    gameDates: GAME_DATES,
    gameCounts: GAME_COUNTS,
    isCurrentSeason: true,
  };
  return render(<DateNavigation {...defaults} {...props} />);
}

describe("DateNavigation — month label", () => {
  it("shows the month and year of the selectedDate", () => {
    renderNav({ selectedDate: "2025-06-15" });
    expect(screen.getByText("June 2025")).toBeInTheDocument();
  });

  it("shows today's month when isCurrentSeason and selectedDate is null", () => {
    // Today is June 2025
    renderNav({ selectedDate: null, isCurrentSeason: true });
    expect(screen.getByText("June 2025")).toBeInTheDocument();
  });

  it("shows the last game date's month for past seasons", () => {
    renderNav({
      selectedDate: null,
      isCurrentSeason: false,
      gameDates: ["2024-01-10", "2024-05-20"],
    });
    expect(screen.getByText("May 2024")).toBeInTheDocument();
  });
});

describe("DateNavigation — Today button", () => {
  it("shows the Today button when isCurrentSeason is true", () => {
    renderNav({ isCurrentSeason: true });
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("hides the Today button when isCurrentSeason is false", () => {
    renderNav({ isCurrentSeason: false });
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("Today button is enabled when selectedDate is null (default overview)", () => {
    renderNav({ selectedDate: null, isCurrentSeason: true });
    const todayBtn = screen.getByText("Today");
    expect(todayBtn).not.toBeDisabled();
  });

  it("Today button is disabled when selectedDate matches today", () => {
    renderNav({ selectedDate: "2025-06-15", isCurrentSeason: true });
    expect(screen.getByText("Today")).toBeDisabled();
  });

  it("Today button is enabled and calls onDateChange when viewing a past date", () => {
    const onDateChange = vi.fn();
    renderNav({ selectedDate: "2025-06-10", onDateChange, isCurrentSeason: true });
    const todayBtn = screen.getByText("Today");
    expect(todayBtn).not.toBeDisabled();
    fireEvent.click(todayBtn);
    expect(onDateChange).toHaveBeenCalledWith("2025-06-15");
  });
});

describe("DateNavigation — calendar toggle", () => {
  it("renders the calendar toggle button", () => {
    renderNav();
    expect(screen.getByLabelText("Open calendar")).toBeInTheDocument();
  });

  it("CalendarPopup is not rendered initially", () => {
    renderNav();
    expect(screen.queryByTestId("calendar-popup")).not.toBeInTheDocument();
  });

  it("opens the CalendarPopup when the toggle is clicked", () => {
    renderNav();
    fireEvent.click(screen.getByLabelText("Open calendar"));
    expect(screen.getByTestId("calendar-popup")).toBeInTheDocument();
  });

  it("closes the CalendarPopup when the toggle is clicked again", () => {
    renderNav();
    fireEvent.click(screen.getByLabelText("Open calendar"));
    fireEvent.click(screen.getByLabelText("Open calendar"));
    expect(screen.queryByTestId("calendar-popup")).not.toBeInTheDocument();
  });
});

describe("DateNavigation — props passed to DateStrip", () => {
  it("forwards selectedDate to DateStrip", () => {
    renderNav({ selectedDate: "2025-06-15" });
    expect(screen.getByTestId("date-strip").dataset.selected).toBe("2025-06-15");
  });

  it("forwards gameDates to DateStrip", () => {
    renderNav({ gameDates: GAME_DATES });
    const passed = JSON.parse(screen.getByTestId("date-strip").dataset.gamedates);
    expect(passed).toEqual(GAME_DATES);
  });

  it("forwards gameCounts to DateStrip", () => {
    renderNav({ gameCounts: GAME_COUNTS });
    const passed = JSON.parse(screen.getByTestId("date-strip").dataset.gamecounts);
    expect(passed["2025-06-10"]).toBe(2);
    expect(passed["2025-06-15"]).toBe(3);
    expect(passed["2025-06-20"]).toBe(4);
  });
});
