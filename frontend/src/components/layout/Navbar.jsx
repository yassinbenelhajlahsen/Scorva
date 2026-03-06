import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/favicon.png";
import SearchBar from "../ui/SearchBar.jsx";
import { useSearch } from "../../hooks/useSearch.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const { results: allItems, loading } = useSearch(query);
  const navRef = useRef(null);
  const location = useLocation();
  const { session, openAuthModal } = useAuth();

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
    { to: "/about", label: "About" },
  ];

  return (
    <nav ref={navRef} className="sticky top-0 z-50 bg-[#0a0a0c] sm:bg-[rgba(10,10,12,0.88)] sm:backdrop-blur-2xl border-b border-white/[0.06]">
      {/* Main row */}
      <div className="relative flex items-center px-5 py-3">
        {/* Left: Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
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
                className={`text-sm font-medium transition-colors duration-200 ${
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
            <>
              <div className="w-px h-4 bg-white/[0.12]" />
              {session ? (
                <Link
                  to="/settings"
                  className={`text-sm font-medium transition-colors duration-200 ${
                    location.pathname.startsWith("/settings")
                      ? "text-accent"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Account
                </Link>
              ) : (
                <button
                  onClick={openAuthModal}
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-200"
                >
                  Sign In
                </button>
              )}
            </>
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
