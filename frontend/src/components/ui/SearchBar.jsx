import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import slugify from "../../utilities/slugify.js";

export default function SearchBar({ allItems, query, setQuery, loading }) {
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

  function handleSelect(item) {
    const base =
      item.type === "game"
        ? `/${item.league}/games/${item.id}`
        : `/${item.league}/${item.type}s/${slugify(item.name)}`;
    navigate(base);
    setQuery("");
  }

  const showDropdown =
    query.trim().length > 0 && (allItems.length > 0 || loading);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-sm flex-grow">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players, teams, games..."
          className="w-full px-4 py-2 pr-10 rounded-full bg-zinc-800 text-white placeholder-gray-400 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {showDropdown && (
        <ul className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md max-h-80 overflow-y-auto shadow-xl scrollbar-thin">
          {loading && allItems.length === 0 ? (
            <li className="px-4 py-3 text-gray-400 text-center">
              Searching...
            </li>
          ) : allItems.length === 0 ? (
            <li className="px-4 py-3 text-gray-400 text-center">
              No results found
            </li>
          ) : (
            allItems.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelect(item)}
                className="flex items-center px-4 py-3 hover:bg-zinc-700 cursor-pointer transition-colors border-b border-zinc-700 last:border-b-0"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className={`mr-3 ${
                      item.type === "team"
                        ? "w-10 h-10 rounded-md object-contain"
                        : "w-8 h-10 rounded-full object-cover"
                    }`}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-400 uppercase">
                    {item.type} • {item.league}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
