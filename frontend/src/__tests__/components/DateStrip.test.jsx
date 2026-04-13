// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DateStrip from "../../components/ui/DateStrip.jsx";

// Pin "today" to 2025-06-15 (Sunday) for deterministic tests
const TODAY = "2025-06-15";
beforeEach(() => {
  vi.useFakeTimers();
  // 2025-06-15 12:00 ET = 16:00 UTC
  vi.setSystemTime(new Date("2025-06-15T16:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const GAME_DATES = ["2025-06-14", "2025-06-15", "2025-06-17", "2025-06-18"];
const GAME_COUNTS = new Map(GAME_DATES.map((d, i) => [d, i + 1])); // 1, 2, 3, 4

function renderStrip(props = {}) {
  const defaults = {
    selectedDate: null,
    onDateChange: vi.fn(),
    gameDates: GAME_DATES,
    gameCounts: GAME_COUNTS,
  };
  return render(<DateStrip {...defaults} {...props} />);
}

describe("DateStrip — rendering", () => {
  it("renders exactly 7 date buttons plus 2 nav buttons", () => {
    renderStrip();
    const buttons = screen.getAllByRole("button");
    // 7 date pills + Previous week + Next week = 9
    expect(buttons).toHaveLength(9);
  });

  it("renders the Previous week and Next week nav buttons", () => {
    renderStrip();
    expect(screen.getByLabelText("Previous week")).toBeInTheDocument();
    expect(screen.getByLabelText("Next week")).toBeInTheDocument();
  });

  it("shows today's date in the strip when selectedDate is null", () => {
    renderStrip({ selectedDate: null });
    // Today is 2025-06-15 → 6/15
    expect(screen.getByLabelText(/6\/15.*today/)).toBeInTheDocument();
  });
});

describe("DateStrip — game date highlighting", () => {
  it("enables buttons for dates that have games", () => {
    renderStrip();
    // 6/15 is in GAME_DATES
    const btn = screen.getByLabelText(/6\/15/);
    expect(btn).not.toBeDisabled();
  });

  it("disables buttons for dates without games", () => {
    renderStrip();
    // 6/16 is NOT in GAME_DATES
    const btn = screen.getByLabelText(/6\/16/);
    expect(btn).toBeDisabled();
  });

  it("includes (no games) in the aria-label for disabled dates", () => {
    renderStrip();
    expect(screen.getByLabelText(/6\/16.*no games/)).toBeInTheDocument();
  });

  it("includes (today) in the aria-label for today's date", () => {
    renderStrip();
    expect(screen.getByLabelText(/6\/15.*today/)).toBeInTheDocument();
  });
});

describe("DateStrip — selection", () => {
  it("applies accent class to the selected date button", () => {
    renderStrip({ selectedDate: TODAY });
    const btn = screen.getByLabelText(/6\/15/);
    expect(btn.className).toContain("bg-accent");
  });

  it("calls onDateChange with the date string when a game-date is clicked", () => {
    const onDateChange = vi.fn();
    renderStrip({ onDateChange });
    fireEvent.click(screen.getByLabelText(/6\/15/));
    expect(onDateChange).toHaveBeenCalledWith("2025-06-15");
  });

  it("does not call onDateChange when a disabled date is clicked", () => {
    const onDateChange = vi.fn();
    renderStrip({ onDateChange });
    // 6/16 has no games and is disabled — fireEvent.click won't trigger onClick
    fireEvent.click(screen.getByLabelText(/6\/16/));
    expect(onDateChange).not.toHaveBeenCalled();
  });
});

describe("DateStrip — window navigation", () => {
  it("shifts the visible window back 7 days when Previous is clicked", () => {
    // Start with today (2025-06-15) centered
    renderStrip({ selectedDate: TODAY });
    fireEvent.click(screen.getByLabelText("Previous week"));
    // After shifting back 7 days from window centered on 6/12..6/18, new window is ~6/5..6/11
    expect(screen.getByLabelText(/6\/8/)).toBeInTheDocument();
  });

  it("shifts the visible window forward 7 days when Next is clicked", () => {
    renderStrip({ selectedDate: TODAY });
    fireEvent.click(screen.getByLabelText("Next week"));
    // Window shifts to 6/19..6/25
    expect(screen.getByLabelText(/6\/22/)).toBeInTheDocument();
  });

  it("disables Next week button when window would exceed today + 14 days", () => {
    // Move far enough forward that the next window would go past 6/29 (6/15 + 14)
    renderStrip({ selectedDate: TODAY });
    // Click Next twice to move past the maxDate boundary
    const nextBtn = screen.getByLabelText("Next week");
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(nextBtn).toBeDisabled();
  });
});

describe("DateStrip — game counts", () => {
  it("renders the game count for a date that has games", () => {
    // 2025-06-15 has count=2 in GAME_COUNTS (index 1)
    renderStrip();
    const btn = screen.getByLabelText(/6\/15/);
    expect(btn).toHaveTextContent("2");
  });

  it("does not render a visible count for a date without games", () => {
    // 2025-06-16 is not in GAME_DATES — count span is always present but invisible
    renderStrip();
    const btn = screen.getByLabelText(/6\/16/);
    const spans = btn.querySelectorAll("span");
    expect(spans).toHaveLength(3);
    expect(spans[2]).toHaveClass("invisible");
  });

  it("renders counts when gameCounts is not provided", () => {
    // Should render without errors — counts simply absent
    renderStrip({ gameCounts: undefined });
    expect(screen.getByLabelText(/6\/15/)).toBeInTheDocument();
  });
});

describe("DateStrip — centering behavior", () => {
  it("centers the window on selectedDate when provided", () => {
    // selectedDate 2025-06-18 → window should be 6/15..6/21
    renderStrip({ selectedDate: "2025-06-18" });
    expect(screen.getByLabelText(/6\/18/)).toBeInTheDocument();
    expect(screen.getByLabelText(/6\/15/)).toBeInTheDocument();
  });

  it("re-centers on the last game date when gameDates loads from empty", () => {
    const { rerender } = render(
      <DateStrip selectedDate={null} onDateChange={vi.fn()} gameDates={[]} />
    );
    // Now provide game dates — strip should re-center
    rerender(
      <DateStrip selectedDate={null} onDateChange={vi.fn()} gameDates={GAME_DATES} />
    );
    // 6/15 should be visible (today is in range)
    expect(screen.getByLabelText(/6\/15/)).toBeInTheDocument();
  });
});
