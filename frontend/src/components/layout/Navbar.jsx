import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import logo from "../../assets/favicon.png";
import SearchBar from "../ui/SearchBar.jsx";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef(null);

  const fetchResults = useCallback(async (searchTerm) => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
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

    return () => {
      clearTimeout(debounce);
    };
  }, [query, fetchResults]);

  return (
    <nav className="bg-zinc-900 text-white flex flex-col sm:flex-row items-center justify-between px-6 py-4 shadow-md gap-4">
      <div className="flex items-center gap-2">
        <Link to="/">
          <img src={logo} alt="Logo" className="w-10 h-10" />
        </Link>
        <div className="text-2xl font-bold hover:text-orange-400 transition">
          <Link to="/">Scorva</Link>
        </div>
      </div>

      <SearchBar
        allItems={allItems}
        query={query}
        setQuery={setQuery}
        loading={loading}
      />

      <div className="flex gap-4">
        <Link to="/nba" className="hover:text-orange-400 transition">
          NBA
        </Link>
        <Link to="/nfl" className="hover:text-orange-400 transition">
          NFL
        </Link>
        <Link to="/nhl" className="hover:text-orange-400 transition">
          NHL
        </Link>
        <Link to="/about" className="hover:text-orange-400 transition">
          About
        </Link>
      </div>
    </nav>
  );
}
