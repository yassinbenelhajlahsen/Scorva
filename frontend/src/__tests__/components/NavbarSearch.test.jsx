// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

describe("NavbarSearch — open / close", () => {
  it("opens when the magnifier is clicked", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close search/i })).toBeInTheDocument();
  });

  it("closes when the X button is clicked", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.click(screen.getByRole("button", { name: /close search/i }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("closes when clicking outside the component", () => {
    const outside = document.createElement("div");
    outside.setAttribute("data-testid", "outside");
    document.body.appendChild(outside);

    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.mouseDown(outside);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    document.body.removeChild(outside);
  });

  it("does not close when clicking inside the open container", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.mouseDown(screen.getByRole("textbox"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});

describe("NavbarSearch — slash shortcut", () => {
  it("opens when '/' is pressed and focus is on body", () => {
    renderAt();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does NOT open when '/' is pressed inside another input", () => {
    const otherInput = document.createElement("input");
    document.body.appendChild(otherInput);
    otherInput.focus();

    const { container } = renderAt();
    fireEvent.keyDown(otherInput, { key: "/" });
    expect(within(container).queryByRole("textbox")).not.toBeInTheDocument();

    document.body.removeChild(otherInput);
  });

  it("does NOT open when '/' is pressed inside a textarea", () => {
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();

    const { container } = renderAt();
    fireEvent.keyDown(ta, { key: "/" });
    expect(within(container).queryByRole("textbox")).not.toBeInTheDocument();

    document.body.removeChild(ta);
  });

  it("does NOT open when '/' is pressed with a modifier key (Cmd / Ctrl / Alt)", () => {
    const { container } = renderAt();
    fireEvent.keyDown(document.body, { key: "/", metaKey: true });
    expect(within(container).queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "/", ctrlKey: true });
    expect(within(container).queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "/", altKey: true });
    expect(within(container).queryByRole("textbox")).not.toBeInTheDocument();
  });
});
