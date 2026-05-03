// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock("../../hooks/data/useSearch.js", () => ({
  useSearch: vi.fn(() => ({ results: [], loading: false })),
}));

vi.mock("../../hooks/data/useDuplicatePlayerSlugs.js", () => ({
  useDuplicatePlayerSlugs: () => ({}),
  useDuplicatePlayerSlugsAll: () => ({ nba: {}, nfl: {}, nhl: {} }),
}));

const NavbarSearch = (await import("../../components/layout/NavbarSearch.jsx")).default;

function renderAt(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavbarSearch />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NavbarSearch — closed state", () => {
  it("renders the magnifier button with an Open search label", () => {
    renderAt();
    expect(screen.getByRole("button", { name: /open search/i })).toBeInTheDocument();
  });

  it("does not render the search input when closed", () => {
    renderAt();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
