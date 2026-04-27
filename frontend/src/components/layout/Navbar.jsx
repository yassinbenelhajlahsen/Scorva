import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";
import logo from "/favicon.webp";
import SearchBar from "../ui/SearchBar.jsx";
import { useSearch } from "../../hooks/data/useSearch.js";
import { useAuth } from "../../context/AuthContext.jsx";
import AvatarDropdown from "./AvatarDropdown.jsx";
import { useFavoritesPanel } from "../../context/FavoritesPanelContext.jsx";
import { useFavorites } from "../../hooks/user/useFavorites.js";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const { results: allItems, loading } = useSearch(query);
  const navRef = useRef(null);
  const location = useLocation();
  const { session, openAuthModal } = useAuth();
  const { togglePanel: toggleFavorites } = useFavoritesPanel();
  const { favorites } = useFavorites();
  const queryClient = useQueryClient();
  const leagueSlugs = new Set(["nba", "nfl", "nhl"]);

  function prefetchLeague(to) {
    const league = to.slice(1);
    if (!leagueSlugs.has(league)) return;
    queryClient.prefetchQuery({ queryKey: queryKeys.leagueGames(league, null, null), queryFn: queryFns.leagueGames(league, null, null), staleTime: 10_000 });
    queryClient.prefetchQuery({ queryKey: queryKeys.gameDates(league, null), queryFn: queryFns.gameDates(league, null), staleTime: 10_000 });
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { to: "/nba", label: "NBA" },
    { to: "/nfl", label: "NFL" },
    { to: "/nhl", label: "NHL" },
  ];

  return (
    <nav ref={navRef} className="sticky top-0 z-50 bg-[#0a0a0c] sm:bg-[rgba(10,10,12,0.88)] sm:backdrop-blur-2xl border-b border-white/[0.06]">
      {/* Main row */}
      <div className="relative flex items-center px-5 py-3">
        {/* Left: Brand */}
        <Link
          to="/"
          className="flex items-center gap-2.5 shrink-0"
          onMouseEnter={() => {
            if (window.matchMedia("(hover: hover)").matches) {
              queryClient.prefetchQuery({ queryKey: queryKeys.homeGames(), queryFn: queryFns.homeGames(), staleTime: 10_000 });
            }
          }}
        >
          <img src={logo} alt="Scorva" className="w-7 h-7" />
          <span className="text-base font-semibold tracking-tight text-text-primary hover:text-accent transition-colors duration-200">
            Scorva
          </span>
        </Link>

        {/* Center: Search — desktop only, truly centered */}
        <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
          <SearchBar
            allItems={allItems}
            query={query}
            setQuery={setQuery}
            loading={loading}
          />
        </div>

        {/* Right: Nav links + divider + auth */}
        <div className="ml-auto flex items-center gap-5 shrink-0">
          {navLinks.map(({ to, label }) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onMouseEnter={() => prefetchLeague(to)}
                className={`touch-target text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {session === undefined ? null : (
            <div className="flex items-center gap-3">
              <div className="w-px h-4 bg-white/[0.12]" />
              {session ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleFavorites}
                    aria-label="Toggle favorites"
                    className="touch-target rounded-full hover:bg-white/[0.06] transition-all duration-200"
                  >
                    {favorites && (favorites.players.length > 0 || favorites.teams.length > 0) ? (
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                      </svg>
                    )}
                  </button>
                  <AvatarDropdown />
                </div>
              ) : (
                <button
                  onClick={openAuthModal}
                  className="touch-target text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-200"
                >
                  Sign In
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile search row */}
      <div className="sm:hidden px-5 pb-3 flex justify-center">
        <SearchBar
          allItems={allItems}
          query={query}
          setQuery={setQuery}
          loading={loading}
        />
      </div>
    </nav>
  );
}
