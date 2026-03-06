import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext.jsx";
import { useFavorites } from "../../hooks/useFavorites.js";
import { useUserPrefs } from "../../hooks/useUserPrefs.js";
import { useSearch } from "../../hooks/useSearch.js";
import {
  addFavoritePlayer,
  addFavoriteTeam,
  removeFavoritePlayer,
  removeFavoriteTeam,
} from "../../api/favorites.js";
import { updateProfile } from "../../api/user.js";

const LEAGUES = [
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "nhl", label: "NHL" },
];

function AddFavoriteSearch({ session, onAdded }) {
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
      onAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div ref={containerRef} className="relative mb-8">
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
          placeholder="Search players and teams to add..."
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
          <motion.ul
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
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function FavoriteRow({ item, type, onRemove }) {
  const { session } = useAuth();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!session || removing) return;
    setRemoving(true);
    try {
      const token = session.access_token;
      if (type === "player") await removeFavoritePlayer(item.id, { token });
      else await removeFavoriteTeam(item.id, { token });
      onRemove();
    } catch (err) {
      console.error(err);
      setRemoving(false);
    }
  }

  const imageUrl = type === "player" ? item.image_url : item.logo_url;
  const subtitle =
    type === "player"
      ? [item.position, item.team_name].filter(Boolean).join(" · ")
      : [item.location, item.record].filter(Boolean).join(" · ");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 py-3 px-4 hover:bg-surface-overlay/50 transition-colors duration-150 group"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.name}
          className={`shrink-0 ${type === "team" ? "w-9 h-9 rounded-lg object-contain" : "w-8 h-9 rounded-full object-cover"}`}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      ) : (
        <div className={`shrink-0 bg-surface-overlay flex items-center justify-center ${type === "team" ? "w-9 h-9 rounded-lg" : "w-8 h-8 rounded-full"}`}>
          <span className="text-xs font-semibold text-text-tertiary">{item.name?.[0]}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">{item.name}</div>
        {subtitle && <div className="text-xs text-text-tertiary truncate mt-0.5">{subtitle}</div>}
      </div>
      <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest shrink-0 mr-2">{item.league}</span>
      <button
        onClick={handleRemove}
        disabled={removing}
        className="shrink-0 p-1.5 rounded-lg text-text-tertiary hover:text-loss hover:bg-loss/10 transition-all duration-150 opacity-0 group-hover:opacity-100"
        aria-label={`Remove ${item.name}`}
      >
        {removing ? (
          <div className="w-3.5 h-3.5 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>
    </motion.div>
  );
}

export default function FavoritesTab() {
  const { session } = useAuth();
  const { favorites, loading, refresh } = useFavorites();
  const { prefs, refresh: refreshPrefs } = useUserPrefs();
  const [selectedLeague, setSelectedLeague] = useState(null);

  useEffect(() => {
    if (prefs?.default_league && selectedLeague === null) {
      setSelectedLeague(prefs.default_league);
    }
  }, [prefs]);

  const activeLeague = selectedLeague ?? "nba";

  function saveDefaultLeague(id) {
    if (!session) return;
    setSelectedLeague(id);
    updateProfile({ defaultLeague: id }, { token: session.access_token })
      .then(() => refreshPrefs())
      .catch(console.error);
  }

  const players = favorites?.players ?? [];
  const teams = favorites?.teams ?? [];
  const hasAny = players.length > 0 || teams.length > 0;

  return (
    <div>
      {/* Default League */}
      <div className="mb-8">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Default League</h3>
          <p className="text-xs text-text-tertiary mt-1">The league shown first when you visit the homepage.</p>
        </div>
        <div className="flex bg-surface-elevated border border-white/[0.06] rounded-xl p-1 gap-1">
          {LEAGUES.map((l) => {
            const active = selectedLeague !== null && activeLeague === l.id;
            return (
              <button
                key={l.id}
                onClick={() => saveDefaultLeague(l.id)}
                className={`relative flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="default-league-indicator"
                    className="absolute inset-0 bg-surface-overlay rounded-lg shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <span className="relative">{l.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Favorites</h2>
        <p className="text-sm text-text-tertiary mt-1">Search to add players and teams. Remove any time.</p>
      </div>

      <AddFavoriteSearch session={session} onAdded={refresh} />

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-elevated/60 animate-pulse" />
          ))}
        </div>
      ) : !hasAny ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-white/[0.08] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-secondary">No favorites yet</p>
          <p className="text-xs text-text-tertiary mt-1">Use the search above to add players and teams.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {players.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest mb-2 px-1">Players</p>
              <div className="bg-surface-elevated border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
                <AnimatePresence mode="popLayout">
                  {players.map((p) => (
                    <FavoriteRow key={p.id} item={p} type="player" onRemove={refresh} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}
          {teams.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest mb-2 px-1">Teams</p>
              <div className="bg-surface-elevated border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
                <AnimatePresence mode="popLayout">
                  {teams.map((t) => (
                    <FavoriteRow key={t.id} item={t} type="team" onRemove={refresh} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>
      )}

    </div>
  );
}
