import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import logo from "../../assets/favicon.png";
import SearchBar from "../ui/SearchBar.jsx";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef(null);
  const location = useLocation();

  const fetchResults = useCallback(async (searchTerm) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/search`,
        {
          params: { term: searchTerm },
          signal: abortControllerRef.current.signal,
        }
      );
      setAllItems(data);
    } catch (err) {
      if (err.name !== "CanceledError") {
        console.error("Search error:", err);
        setAllItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setAllItems([]);
      setLoading(false);
      return;
    }
    const debounce = setTimeout(() => {
      fetchResults(trimmedQuery);
    }, 200);
    return () => clearTimeout(debounce);
  }, [query, fetchResults]);

  const navLinks = [
    { to: "/nba", label: "NBA" },
    { to: "/nfl", label: "NFL" },
    { to: "/nhl", label: "NHL" },
    { to: "/about", label: "About" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[rgba(10,10,12,0.88)] backdrop-blur-2xl border-b border-white/[0.06]">
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

        {/* Right: Nav links */}
        <div className="ml-auto flex items-center gap-5 shrink-0">
          {navLinks.map(({ to, label }) => {
            const isActive =
              label !== "About" && location.pathname.startsWith(to);
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
