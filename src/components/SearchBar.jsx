import { useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import slugify from "../HelperFunctions/slugify.js";

export default function SearchBar({ allItems, query, setQuery }) {
  const navigate = useNavigate();
  const wrapperRef = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setQuery("");     
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setQuery]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seenIds = new Set();
    const matches = [];
    for (const item of allItems) {
      if (matches.length >= 10) break;
      if (
        item.name.toLowerCase().includes(q) &&
        !seenIds.has(item.id)
      ) {
        seenIds.add(item.id);
        matches.push(item);
      }
    }
    return matches;
  }, [query, allItems]);

  function handleSelect(item) {
    setQuery(item.name);
    const base = item.type === "game"
      ? `/${item.league}/games/${item.id}`
      : `/${item.league}/${item.type}s/${slugify(item.name)}`;
    navigate(base);
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-sm flex-grow">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search players, teams, games..."
        className="w-full px-4 py-2 rounded-full bg-zinc-800 text-white placeholder-gray-400 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
      />

      {suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md max-h-60 overflow-auto">
          {suggestions.map(item => (
            <li
              key={item.id}
              onClick={() => handleSelect(item)}
              className="flex items-center px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            >
              {item.type !== "game" && (
                <img
  src={item.imageUrl}
  alt={item.name}
  className={`
    mr-3
    ${item.type === "team"
      ? "w-12 h-12 rounded-md object-contain"      
      : "w-10 h-14 rounded-full object-cover"}   
  `}
/>

              )}
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
