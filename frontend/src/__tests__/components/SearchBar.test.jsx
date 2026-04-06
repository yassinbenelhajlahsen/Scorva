import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../utils/slugify.js", () => ({
  default: (s) => s.toLowerCase().replace(/\s+/g, "-"),
}));

const SearchBar = (await import("../../components/ui/SearchBar.jsx")).default;

const mockPlayer = { type: "player", id: 1, name: "LeBron James", league: "nba", imageUrl: null, position: "F", team_name: "Lakers" };
const mockTeam   = { type: "team",   id: 2, name: "Golden State Warriors", league: "nba", imageUrl: "/logo.webp" };
const mockGame   = { type: "game",   id: 3, name: "Lakers vs Warriors", league: "nba", date: "2025-01-15T00:00:00Z", imageUrl: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SearchBar", () => {
  it("renders the search input", () => {
    render(<SearchBar allItems={[]} query="" setQuery={vi.fn()} loading={false} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("calls setQuery on input change", () => {
    const setQuery = vi.fn();
    render(<SearchBar allItems={[]} query="" setQuery={setQuery} loading={false} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "leb" } });
    expect(setQuery).toHaveBeenCalledWith("leb");
  });

  it("shows loading spinner when loading", () => {
    render(<SearchBar allItems={[]} query="leb" setQuery={vi.fn()} loading={true} />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("does not show dropdown when query is empty", () => {
    render(<SearchBar allItems={[mockPlayer]} query="" setQuery={vi.fn()} loading={false} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows 'Searching...' when loading and no items", () => {
    render(<SearchBar allItems={[]} query="leb" setQuery={vi.fn()} loading={true} />);
    expect(screen.getByText("Searching...")).toBeInTheDocument();
  });

  it("does not show dropdown when no items and not loading (showDropdown=false)", () => {
    render(<SearchBar allItems={[]} query="zzz" setQuery={vi.fn()} loading={false} />);
    // showDropdown requires allItems.length > 0 OR loading — neither is true here
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders player results with name and type", () => {
    render(<SearchBar allItems={[mockPlayer]} query="leb" setQuery={vi.fn()} loading={false} />);
    expect(screen.getByText("LeBron James")).toBeInTheDocument();
    expect(screen.getByText(/player/i)).toBeInTheDocument();
  });

  it("navigates to player page on player click", () => {
    const setQuery = vi.fn();
    render(<SearchBar allItems={[mockPlayer]} query="leb" setQuery={setQuery} loading={false} />);
    fireEvent.click(screen.getByText("LeBron James").closest("li"));
    expect(mockNavigate).toHaveBeenCalledWith("/nba/players/lebron-james");
    expect(setQuery).toHaveBeenCalledWith("");
  });

  it("navigates to team page on team click", () => {
    render(<SearchBar allItems={[mockTeam]} query="war" setQuery={vi.fn()} loading={false} />);
    fireEvent.click(screen.getByText("Golden State Warriors").closest("li"));
    expect(mockNavigate).toHaveBeenCalledWith("/nba/teams/golden-state-warriors");
  });

  it("navigates to game page on game click", () => {
    render(<SearchBar allItems={[mockGame]} query="lake" setQuery={vi.fn()} loading={false} />);
    fireEvent.click(screen.getByText("Lakers vs Warriors").closest("li"));
    expect(mockNavigate).toHaveBeenCalledWith("/nba/games/3");
  });

  it("renders team image when imageUrl provided", () => {
    render(<SearchBar allItems={[mockTeam]} query="war" setQuery={vi.fn()} loading={false} />);
    expect(screen.getByAltText("Golden State Warriors")).toBeInTheDocument();
  });

  it("renders player position and team info", () => {
    render(<SearchBar allItems={[mockPlayer]} query="leb" setQuery={vi.fn()} loading={false} />);
    expect(screen.getByText(/F · Lakers/)).toBeInTheDocument();
  });
});
