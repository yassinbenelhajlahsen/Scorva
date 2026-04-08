import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { m, AnimatePresence } from "framer-motion";
import { useSearch } from "../../hooks/data/useSearch.js";
import slugify from "../../utils/slugify.js";

/**
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - league: string (nba/nfl/nhl)
 * - entityType: "player" | "team"
 * - source: { id, name, imageUrl } — the entity being compared FROM
 */
export default function CompareModal({ isOpen, onClose, league, entityType, source }) {
  const [query, setQuery] = useState("");
  const { results, loading } = useSearch(query);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const filtered = results.filter(
    (r) => r.type === entityType && r.league === league && r.id !== source?.id
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleSelect = (item) => {
    const sourceSlug = slugify(source.name);
    const targetSlug = slugify(item.name);
    const type = entityType === "player" ? "players" : "teams";
    onClose();
    navigate(`/${league}/compare?type=${type}&ids=${sourceSlug},${targetSlug}`);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <m.div
            key="compare-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <m.div
            key="compare-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[101] inset-x-4 top-[15vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md"
          >
            <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={source?.imageUrl || "/images/placeholder.png"}
                    alt={source?.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{source?.name}</p>
                    <p className="text-xs text-text-tertiary">Compare with...</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-colors duration-200"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search input */}
              <div className="px-5 py-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${league.toUpperCase()} ${entityType}s...`}
                    className="w-full bg-surface-overlay border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors duration-200"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="max-h-[300px] overflow-y-auto px-2 pb-3 scrollbar-thin">
                {loading && query.trim() && (
                  <div className="px-3 py-6 text-center">
                    <div className="inline-block w-5 h-5 border-2 border-text-tertiary/30 border-t-accent rounded-full animate-spin" />
                  </div>
                )}

                {!loading && query.trim() && filtered.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-text-tertiary">
                    No {entityType}s found in {league.toUpperCase()}
                  </p>
                )}

                {!loading && filtered.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors duration-200 text-left"
                  >
                    <img
                      src={item.imageUrl || "/images/placeholder.png"}
                      alt={item.name}
                      className={`w-9 h-9 object-cover shrink-0 ${entityType === "player" ? "rounded-full" : "rounded-lg object-contain"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                      {entityType === "player" && item.position && (
                        <p className="text-xs text-text-tertiary truncate">
                          {item.position}{item.team_name ? ` \u00b7 ${item.team_name}` : ""}
                        </p>
                      )}
                      {entityType === "team" && item.shortname && (
                        <p className="text-xs text-text-tertiary">{item.shortname}</p>
                      )}
                    </div>
                  </button>
                ))}

                {!query.trim() && (
                  <p className="px-3 py-6 text-center text-sm text-text-tertiary">
                    Search for a {entityType} to compare
                  </p>
                )}
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
