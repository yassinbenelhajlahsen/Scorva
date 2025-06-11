import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import logo from "../assets/favicon.png";
import SearchBar from "./SearchBar.jsx";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query) {
      setAllItems([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/search`, {
          params: { term: query }
        });
        setAllItems(data);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to fetch search results');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query]);

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

      <SearchBar allItems={allItems} query={query} setQuery={setQuery} loading={loading} error={error} />

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
