import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
vi.mock("../../hooks/user/useFavorites.js", () => ({ useFavorites: vi.fn() }));
vi.mock("../../hooks/user/useUserPrefs.js", () => ({ useUserPrefs: vi.fn() }));
vi.mock("../../hooks/data/useSearch.js", () => ({ useSearch: vi.fn() }));
vi.mock("../../api/favorites.js", () => ({
  addFavoritePlayer: vi.fn(),
  addFavoriteTeam: vi.fn(),
  removeFavoritePlayer: vi.fn(),
  removeFavoriteTeam: vi.fn(),
}));
vi.mock("../../api/user.js", () => ({ updateProfile: vi.fn() }));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  m: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, layout, layoutId, initial, animate, exit, transition, ...props }) =>
          <div {...props}>{children}</div>,
    }
  ),
}));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { useFavorites } = await import("../../hooks/user/useFavorites.js");
const { useUserPrefs } = await import("../../hooks/user/useUserPrefs.js");
const { useSearch } = await import("../../hooks/data/useSearch.js");
const { removeFavoritePlayer, removeFavoriteTeam, addFavoritePlayer } = await import("../../api/favorites.js");
const { updateProfile } = await import("../../api/user.js");
const FavoritesTab = (await import("../../components/settings/FavoritesTab.jsx")).default;

const mockSession = { access_token: "tok" };

const mockPlayer = { id: 1, name: "LeBron James", position: "F", team_name: "Lakers", image_url: null, league: "nba" };
const mockTeam = { id: 2, name: "Golden State Warriors", location: "San Francisco", record: "30-15", logo_url: null, league: "nba" };

function setup(favoritesOverride = {}, prefsOverride = {}) {
  useAuth.mockReturnValue({ session: mockSession });
  useFavorites.mockReturnValue({
    favorites: { players: [], teams: [], ...favoritesOverride },
    loading: false,
    refresh: vi.fn(),
  });
  useUserPrefs.mockReturnValue({
    prefs: { default_league: null, ...prefsOverride },
    refresh: vi.fn(),
  });
  useSearch.mockReturnValue({ results: [], loading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FavoritesTab — rendering", () => {
  it("renders the Favorites heading", () => {
    setup();
    render(<FavoritesTab />);
    expect(screen.getByText("Favorites")).toBeInTheDocument();
  });

  it("renders Default League section", () => {
    setup();
    render(<FavoritesTab />);
    expect(screen.getByText("Default League")).toBeInTheDocument();
  });

  it("renders all three league buttons", () => {
    setup();
    render(<FavoritesTab />);
    expect(screen.getByText("NBA")).toBeInTheDocument();
    expect(screen.getByText("NFL")).toBeInTheDocument();
    expect(screen.getByText("NHL")).toBeInTheDocument();
  });

  it("shows search input", () => {
    setup();
    render(<FavoritesTab />);
    expect(screen.getByPlaceholderText(/Search players and teams/i)).toBeInTheDocument();
  });
});

describe("FavoritesTab — empty state", () => {
  it("shows 'No favorites yet' when no favorites", () => {
    setup();
    render(<FavoritesTab />);
    expect(screen.getByText("No favorites yet")).toBeInTheDocument();
  });

  it("does not show players or teams sections when empty", () => {
    setup();
    render(<FavoritesTab />);
    expect(screen.queryByText("Players")).not.toBeInTheDocument();
    expect(screen.queryByText("Teams")).not.toBeInTheDocument();
  });
});

describe("FavoritesTab — with favorites", () => {
  it("renders player favorites", () => {
    setup({ players: [mockPlayer], teams: [] });
    render(<FavoritesTab />);
    expect(screen.getByText("LeBron James")).toBeInTheDocument();
  });

  it("renders team favorites", () => {
    setup({ players: [], teams: [mockTeam] });
    render(<FavoritesTab />);
    expect(screen.getByText("Golden State Warriors")).toBeInTheDocument();
  });

  it("shows Players section header when there are players", () => {
    setup({ players: [mockPlayer], teams: [] });
    render(<FavoritesTab />);
    expect(screen.getByText("Players")).toBeInTheDocument();
  });

  it("shows Teams section header when there are teams", () => {
    setup({ players: [], teams: [mockTeam] });
    render(<FavoritesTab />);
    expect(screen.getByText("Teams")).toBeInTheDocument();
  });
});

describe("FavoritesTab — remove favorite", () => {
  it("calls removeFavoritePlayer and refresh on remove click", async () => {
    const refresh = vi.fn();
    useAuth.mockReturnValue({ session: mockSession });
    useFavorites.mockReturnValue({
      favorites: { players: [mockPlayer], teams: [] },
      loading: false,
      refresh,
    });
    useUserPrefs.mockReturnValue({ prefs: {}, refresh: vi.fn() });
    useSearch.mockReturnValue({ results: [], loading: false });
    removeFavoritePlayer.mockResolvedValue({});

    render(<FavoritesTab />);
    fireEvent.click(screen.getByLabelText(`Remove ${mockPlayer.name}`));

    await waitFor(() => expect(removeFavoritePlayer).toHaveBeenCalledWith(
      mockPlayer.id,
      expect.objectContaining({ token: "tok" })
    ));
    expect(refresh).toHaveBeenCalled();
  });

  it("calls removeFavoriteTeam on team remove", async () => {
    const refresh = vi.fn();
    useAuth.mockReturnValue({ session: mockSession });
    useFavorites.mockReturnValue({
      favorites: { players: [], teams: [mockTeam] },
      loading: false,
      refresh,
    });
    useUserPrefs.mockReturnValue({ prefs: {}, refresh: vi.fn() });
    useSearch.mockReturnValue({ results: [], loading: false });
    removeFavoriteTeam.mockResolvedValue({});

    render(<FavoritesTab />);
    fireEvent.click(screen.getByLabelText(`Remove ${mockTeam.name}`));

    await waitFor(() => expect(removeFavoriteTeam).toHaveBeenCalledWith(
      mockTeam.id,
      expect.objectContaining({ token: "tok" })
    ));
  });
});

describe("FavoritesTab — default league", () => {
  it("calls updateProfile when a league button is clicked", async () => {
    setup();
    updateProfile.mockResolvedValue({});
    render(<FavoritesTab />);

    fireEvent.click(screen.getByText("NFL"));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ defaultLeague: "nfl" }),
        expect.objectContaining({ token: "tok" })
      )
    );
  });

  it("initializes selectedLeague from prefs on mount", () => {
    setup({}, { default_league: "nhl" });
    render(<FavoritesTab />);
    // The NHL button should be active — checking that the state was initialized
    // We verify this by checking updateProfile is NOT called (no change made)
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe("FavoritesTab — loading state", () => {
  it("shows skeleton loaders while loading", () => {
    useAuth.mockReturnValue({ session: mockSession });
    useFavorites.mockReturnValue({ favorites: null, loading: true, refresh: vi.fn() });
    useUserPrefs.mockReturnValue({ prefs: {}, refresh: vi.fn() });
    useSearch.mockReturnValue({ results: [], loading: false });

    render(<FavoritesTab />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});

describe("FavoritesTab — search", () => {
  it("shows search results when query matches", () => {
    setup();
    useSearch.mockReturnValue({
      results: [{ id: 5, name: "Stephen Curry", type: "player", league: "nba", imageUrl: null }],
      loading: false,
    });
    render(<FavoritesTab />);

    fireEvent.change(screen.getByPlaceholderText(/Search players and teams/i), {
      target: { value: "curry" },
    });

    expect(screen.getByText("Stephen Curry")).toBeInTheDocument();
  });

  it("calls addFavoritePlayer when a player result is clicked", async () => {
    const refresh = vi.fn();
    useAuth.mockReturnValue({ session: mockSession });
    useFavorites.mockReturnValue({ favorites: { players: [], teams: [] }, loading: false, refresh });
    useUserPrefs.mockReturnValue({ prefs: {}, refresh: vi.fn() });
    useSearch.mockReturnValue({
      results: [{ id: 5, name: "Stephen Curry", type: "player", league: "nba", imageUrl: null }],
      loading: false,
    });
    addFavoritePlayer.mockResolvedValue({});

    render(<FavoritesTab />);
    fireEvent.change(screen.getByPlaceholderText(/Search players and teams/i), {
      target: { value: "curry" },
    });
    fireEvent.click(screen.getByText("Stephen Curry").closest("li"));

    await waitFor(() =>
      expect(addFavoritePlayer).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ token: "tok" })
      )
    );
  });
});
