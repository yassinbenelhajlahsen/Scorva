// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import FilterBar from "../../components/highlights/filters/FilterBar.jsx";

function Probe() {
  const [sp] = useSearchParams();
  return <span data-testid="probe">{sp.toString()}</span>;
}

function setup(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <FilterBar window="week" position="all" sort="desc" entity="player" entityOptions={["player","team","game"]} />
      <Probe />
    </MemoryRouter>,
  );
}

describe("FilterBar — entity & position", () => {
  test("renders entity dropdown with Players/Teams/Games", () => {
    setup();
    const entitySelect = screen.getByLabelText(/entity/i);
    expect(entitySelect).toBeInTheDocument();
    expect(entitySelect.querySelectorAll("option")).toHaveLength(3);
  });

  test("changing entity to team writes URL param", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/entity/i), { target: { value: "team" } });
    expect(screen.getByTestId("probe").textContent).toMatch(/entity=team/);
  });

  test("position dropdown is disabled when entity != player", () => {
    render(
      <MemoryRouter>
        <FilterBar window="week" position="all" sort="desc" entity="team" entityOptions={["player","team","game"]} />
      </MemoryRouter>,
    );
    const positionSelect = screen.getByLabelText(/position/i);
    expect(positionSelect).toBeDisabled();
  });

  test("disabled Games option when disabledEntities includes 'game'", () => {
    render(
      <MemoryRouter>
        <FilterBar window="week" position="all" sort="desc" entity="player" entityOptions={["player","team","game"]} disabledEntities={["game"]} />
      </MemoryRouter>,
    );
    const opt = screen.getByRole("option", { name: /Games/i });
    expect(opt).toBeDisabled();
  });

  test("does not render entity dropdown when entityOptions is undefined", () => {
    render(
      <MemoryRouter>
        <FilterBar window="week" position="all" sort="desc" />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText(/entity/i)).toBeNull();
  });
});
