import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const MonthNavigation = (await import("../../components/navigation/MonthNavigation.jsx")).default;

const games = [
  { date: "2025-01-10" },
  { date: "2025-01-15" },
  { date: "2025-02-05" },
  { date: "2025-03-20" },
];

describe("MonthNavigation", () => {
  it("renders null when games is empty", () => {
    const { container } = render(
      <MonthNavigation games={[]} selectedMonth="2025-01" onMonthChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when selectedMonth is null", () => {
    const { container } = render(
      <MonthNavigation games={games} selectedMonth={null} onMonthChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the selected month label", () => {
    render(
      <MonthNavigation games={games} selectedMonth="2025-01" onMonthChange={vi.fn()} />
    );
    expect(screen.getByText(/January 2025/)).toBeInTheDocument();
  });

  it("shows game count for selected month", () => {
    render(
      <MonthNavigation games={games} selectedMonth="2025-01" onMonthChange={vi.fn()} />
    );
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument(); // Jan has 2 games
  });

  it("disables previous button on first month", () => {
    render(
      <MonthNavigation games={games} selectedMonth="2025-01" onMonthChange={vi.fn()} />
    );
    expect(screen.getByLabelText("Previous month")).toBeDisabled();
  });

  it("disables next button on last month", () => {
    render(
      <MonthNavigation games={games} selectedMonth="2025-03" onMonthChange={vi.fn()} />
    );
    expect(screen.getByLabelText("Next month")).toBeDisabled();
  });

  it("enables both buttons in the middle", () => {
    render(
      <MonthNavigation games={games} selectedMonth="2025-02" onMonthChange={vi.fn()} />
    );
    expect(screen.getByLabelText("Previous month")).not.toBeDisabled();
    expect(screen.getByLabelText("Next month")).not.toBeDisabled();
  });

  it("calls onMonthChange with previous month on prev click", () => {
    const onMonthChange = vi.fn();
    render(
      <MonthNavigation games={games} selectedMonth="2025-02" onMonthChange={onMonthChange} />
    );
    fireEvent.click(screen.getByLabelText("Previous month"));
    expect(onMonthChange).toHaveBeenCalledWith("2025-01");
  });

  it("calls onMonthChange with next month on next click", () => {
    const onMonthChange = vi.fn();
    render(
      <MonthNavigation games={games} selectedMonth="2025-02" onMonthChange={onMonthChange} />
    );
    fireEvent.click(screen.getByLabelText("Next month"));
    expect(onMonthChange).toHaveBeenCalledWith("2025-03");
  });

  it("does not call onMonthChange when disabled prev is clicked", () => {
    const onMonthChange = vi.fn();
    render(
      <MonthNavigation games={games} selectedMonth="2025-01" onMonthChange={onMonthChange} />
    );
    fireEvent.click(screen.getByLabelText("Previous month"));
    expect(onMonthChange).not.toHaveBeenCalled();
  });
});
