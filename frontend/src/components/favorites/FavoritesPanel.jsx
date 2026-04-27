import { useCallback, useEffect, useRef } from "react";
import { m } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext.jsx";
import { useFavorites } from "../../hooks/user/useFavorites.js";
import { removeFavoritePlayer, removeFavoriteTeam } from "../../api/favorites.js";
import { queryKeys } from "../../lib/query.js";
import { useSwipeToClose } from "../../hooks/useSwipeToClose.js";
import FavoritePlayersSection from "./FavoritePlayersSection.jsx";
import FavoriteTeamsSection from "./FavoriteTeamsSection.jsx";
import Skeleton from "../ui/Skeleton.jsx";

export default function FavoritesPanel({ onClose }) {
  const panelRef = useRef(null);
  const { session } = useAuth();
  const { favorites, loading } = useFavorites();
  const queryClient = useQueryClient();
  const dragProps = useSwipeToClose(onClose, { direction: "right" });

  const handleRemovePlayer = useCallback((playerId) => {
    queryClient.setQueryData(queryKeys.favorites(), (old) => {
      if (!old) return old;
      return { ...old, players: old.players.filter((p) => p.id !== playerId) };
    });
    removeFavoritePlayer(playerId, { token: session.access_token }).catch(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites() });
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.favoriteCheck("player", playerId) });
  }, [session, queryClient]);

  const handleRemoveTeam = useCallback((teamId) => {
    queryClient.setQueryData(queryKeys.favorites(), (old) => {
      if (!old) return old;
      return { ...old, teams: old.teams.filter((t) => t.id !== teamId) };
    });
    removeFavoriteTeam(teamId, { token: session.access_token }).catch(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites() });
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.favoriteCheck("team", teamId) });
  }, [session, queryClient]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const isMobile =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile) return;
    const htmlEl = document.documentElement;
    const prevHtml = htmlEl.style.overflow;
    const prevBody = document.body.style.overflow;
    htmlEl.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      htmlEl.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => {
    const isMobile =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile || !window.visualViewport) return;
    const panel = panelRef.current;
    if (!panel) return;
    const vv = window.visualViewport;

    function update() {
      panel.style.top = `${vv.offsetTop}px`;
      panel.style.height = `${vv.height}px`;
    }

    update();
    vv.addEventListener("resize", update, { passive: true });
    vv.addEventListener("scroll", update, { passive: true });
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      panel.style.top = "";
      panel.style.height = "";
    };
  }, []);

  const empty = favorites && favorites.players.length === 0 && favorites.teams.length === 0;

  return (
    <m.div
      key="favorites-panel"
      initial={{ opacity: 0, x: 48, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.97 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      ref={panelRef}
      {...dragProps}
      className="fixed top-0 right-0 bottom-0 z-[70] w-full sm:w-[420px] bg-surface-elevated border-l border-white/[0.08] shadow-[-40px_0_80px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-3.5 pt-[max(0.875rem,calc(0.875rem+env(safe-area-inset-top)))] border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
          <span className="text-base font-semibold text-text-primary tracking-tight">Favorites</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close favorites"
          className="touch-target rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[max(1rem,calc(1rem+env(safe-area-inset-bottom)))]" style={{ touchAction: "pan-y" }}>
        {loading || !favorites ? (
          <div className="flex flex-col items-center gap-3 pt-12">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-3.5 w-52" />
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center pt-12 text-center">
            <svg className="w-8 h-8 mb-3 text-yellow-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
            <p className="text-text-secondary text-sm font-medium">Star teams or players to see them here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {favorites.players.length > 0 && (
              <FavoritePlayersSection players={favorites.players} compact onRemove={handleRemovePlayer} />
            )}
            {favorites.teams.length > 0 && (
              <FavoriteTeamsSection teams={favorites.teams} compact onRemove={handleRemoveTeam} />
            )}
          </div>
        )}
      </div>
    </m.div>
  );
}
