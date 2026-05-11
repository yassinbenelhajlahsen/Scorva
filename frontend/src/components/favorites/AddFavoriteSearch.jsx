import { useState, useRef, useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useSearch } from "../../hooks/data/useSearch.js";
import {
  addFavoritePlayer,
  addFavoriteTeam,
} from "../../api/favorites.js";

/**
 * Inline search input + result dropdown for adding favorites.
 * Used in both the Settings → Favorites tab and the FavoritesPanel overlay.
 *
 * Props:
 *  - session: Supabase session (provides access_token for the add call)
 *  - onAdded: callback invoked after a successful add (refresh hook trigger)
 *  - placeholder?: input placeholder text
 */
export default function AddFavoriteSearch({ session, onAdded, placeholder = "Search players and teams to add..." }) {
  const [query, setQuery] = useState("");
  const { results, loading } = useSearch(query);
  const filtered = results.filter((r) => r.type !== "game");
  const showDropdown = query.trim().length > 0 && (filtered.length > 0 || loading);
  const [adding, setAdding] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleAdd(item) {
    if (!session || adding) return;
    setAdding(item.id);
    try {
      const token = session.access_token;
      if (item.type === "player") await addFavoritePlayer(item.id, { token });
      else await addFavoriteTeam(item.id, { token });
      setQuery("");
      onAdded?.();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none"
          fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-elevated text-text-primary placeholder-text-tertiary border border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/30 transition-all duration-200 text-sm"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-white/[0.08] border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <m.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-surface-elevated/95 backdrop-blur-2xl border border-white/[0.1] rounded-xl max-h-64 overflow-y-auto shadow-[0_12px_40px_rgba(0,0,0,0.6)] scrollbar-thin divide-y divide-white/[0.05]"
          >
            {loading && filtered.length === 0 ? (
              <li className="px-4 py-3 text-text-tertiary text-sm text-center">Searching...</li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-3 text-text-tertiary text-sm text-center">No results found</li>
            ) : (
              filtered.map((item) => (
                <li
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleAdd(item)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-overlay cursor-pointer transition-colors duration-150"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className={`shrink-0 ${item.type === "team" ? "w-8 h-8 rounded-lg object-contain" : "w-7 h-8 rounded-full object-cover"}`}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">{item.name}</div>
                      <div className="text-[10px] text-text-tertiary uppercase tracking-wider">{item.type} · {item.league}</div>
                    </div>
                  </div>
                  <div className="shrink-0 ml-3">
                    {adding === item.id ? (
                      <div className="w-4 h-4 border-2 border-white/[0.08] border-t-accent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                  </div>
                </li>
              ))
            )}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
