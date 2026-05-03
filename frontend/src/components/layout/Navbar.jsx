import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";
import logo from "/favicon.webp";
import NavbarSearch from "./NavbarSearch.jsx";
import SearchBar from "../ui/SearchBar.jsx";
import { useSearch } from "../../hooks/data/useSearch.js";
import { useAuth } from "../../context/AuthContext.jsx";
import AvatarDropdown from "./AvatarDropdown.jsx";

export default function Navbar() {
  const navRef = useRef(null);
  const location = useLocation();
  const { session, openAuthModal } = useAuth();
  const queryClient = useQueryClient();
  const leagueSlugs = new Set(["nba", "nfl", "nhl"]);

  // Mobile-only persistent search row state.
  const [mobileQuery, setMobileQuery] = useState("");
  const { results: mobileResults, loading: mobileLoading } = useSearch(mobileQuery);
  useEffect(() => {
    setMobileQuery("");
  }, [location.pathname, location.search]);

  function prefetchLeague(to) {
    if (to === "/reports") {
      queryClient.prefetchInfiniteQuery({
        queryKey: ["reports", "all", "all"],
        queryFn: ({ pageParam = 0, signal }) =>
          queryFns.reports(undefined, undefined, 20, pageParam)({ signal }),
        initialPageParam: 0,
        staleTime: 10_000,
      });
      return;
    }
    const league = to.slice(1);
    if (!leagueSlugs.has(league)) return;
    queryClient.prefetchQuery({ queryKey: queryKeys.leagueGames(league, null, null), queryFn: queryFns.leagueGames(league, null, null), staleTime: 10_000 });
    queryClient.prefetchQuery({ queryKey: queryKeys.gameDates(league, null), queryFn: queryFns.gameDates(league, null), staleTime: 10_000 });
  }

  const leagueLinks = [
    { to: "/nba", label: "NBA" },
    { to: "/nfl", label: "NFL" },
    { to: "/nhl", label: "NHL" },
  ];

  return (
    <nav ref={navRef} className="sticky top-0 z-50 bg-[#0a0a0c] sm:bg-[rgba(10,10,12,0.88)] sm:backdrop-blur-2xl border-b border-white/[0.06]">
      <div className="relative flex items-center px-5 pb-3 pt-[max(0.75rem,calc(0.75rem+env(safe-area-inset-top)))] gap-5">
        {/* Left cluster: brand + league links */}
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

        <div className="flex items-center gap-5 shrink-0">
          {leagueLinks.map(({ to, label }) => {
            const isActive = location.pathname.startsWith(to);
            const currentTab = new URLSearchParams(location.search).get("tab");
            const linkTo = currentTab && leagueSlugs.has(location.pathname.slice(1))
              ? `${to}?tab=${encodeURIComponent(currentTab)}`
              : to;
            return (
              <Link
                key={to}
                to={linkTo}
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
        </div>

        {/* Right cluster: Reports + search + auth */}
        <div className="ml-auto flex items-center gap-5 shrink-0">
          <Link
            to="/reports"
            onMouseEnter={() => prefetchLeague("/reports")}
            className={`touch-target flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${
              location.pathname.startsWith("/reports")
                ? "text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.003 5.5L21 5.5C21.513 5.5 21.936 5.886 21.993 6.383L22 6.5L22 13.5C22 14.052 21.552 14.5 21 14.5C20.487 14.5 20.064 14.114 20.007 13.617L20 13.5L19.999 8.914L12.707 16.207C12.347 16.567 11.78 16.595 11.388 16.291L11.294 16.208L8.998 13.916L3.709 19.205C3.319 19.596 2.686 19.596 2.295 19.206C1.935 18.845 1.907 18.278 2.212 17.886L2.295 17.791L8.29 11.795C8.65 11.435 9.217 11.407 9.609 11.711L9.703 11.794L12 14.086L18.584 7.5L14.003 7.5C13.49 7.5 13.068 7.114 13.01 6.617L13.003 6.5C13.003 5.987 13.389 5.564 13.887 5.507L14.003 5.5Z" />
            </svg>
            Reports
          </Link>

          <div className="hidden sm:block w-px h-4 bg-white/[0.12]" />

          <div className="hidden sm:flex items-center">
            <NavbarSearch />
          </div>

          {session === undefined ? null : (
            <div className="flex items-center gap-3">
              <div className="w-px h-4 bg-white/[0.12]" />
              {session ? (
                <AvatarDropdown />
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

      {/* Mobile-only persistent search row */}
      <div className="sm:hidden px-5 pb-3 flex [&>div]:max-w-none [&>div]:w-full">
        <SearchBar
          allItems={mobileResults}
          query={mobileQuery}
          setQuery={setMobileQuery}
          loading={mobileLoading}
        />
      </div>
    </nav>
  );
}
