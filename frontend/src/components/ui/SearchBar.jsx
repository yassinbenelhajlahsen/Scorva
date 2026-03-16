import { useNavigate } from "react-router-dom";
import slugify from "../../utilities/slugify.js";

export default function SearchBar({ allItems, query, setQuery, loading }) {
  const navigate = useNavigate();

  function handleSelect(item) {
    const base =
      item.type === "game"
        ? `/${item.league}/games/${item.id}`
        : `/${item.league}/${item.type}s/${slugify(item.name)}`;
    navigate(base);
    setQuery("");
  }

  const showDropdown = query.trim().length > 0 && (allItems.length > 0 || loading);

  return (
    <div className="relative w-full max-w-sm flex-grow">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players, teams, games, dates..."
          className="w-full px-4 py-2 pr-10 rounded-full bg-surface-elevated text-text-primary placeholder-text-tertiary border border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/30 transition-all duration-200 text-sm"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-white/[0.08] border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showDropdown && (
        <ul className="absolute z-50 w-full mt-2 bg-surface-elevated/95 backdrop-blur-2xl border border-white/[0.1] rounded-xl max-h-80 overflow-y-auto shadow-[0_12px_40px_rgba(0,0,0,0.6)] scrollbar-thin divide-y divide-white/[0.05]">
          {loading && allItems.length === 0 ? (
            <li className="px-4 py-3 text-text-tertiary text-sm text-center">
              Searching...
            </li>
          ) : allItems.length === 0 ? (
            <li className="px-4 py-3 text-text-tertiary text-sm text-center">
              No results found
            </li>
          ) : (
            allItems.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelect(item)}
                className="flex items-center px-4 py-3 hover:bg-surface-overlay cursor-pointer transition-colors duration-150"
              >
                {item.imageUrl && (
                  <img
                    loading="lazy"
                    src={item.imageUrl}
                    alt={item.name}
                    className={`mr-3 ${
                      item.type === "team"
                        ? "w-9 h-9 rounded-lg object-contain"
                        : "w-8 h-9 rounded-full object-cover"
                    }`}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider mt-0.5">
                    {item.type} · {item.league}
                    {item.type === "game" && item.date && (
                      <> · {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</>
                    )}
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
