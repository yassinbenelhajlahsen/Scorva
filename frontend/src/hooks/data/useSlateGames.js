import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLeagueGames } from "../../api/games.js";
import { useLiveGames } from "../live/useLiveGames.js";
import { useVisibilityReconnect } from "../live/useVisibilityReconnect.js";
import { queryKeys } from "../../lib/query.js";
import { getSlateDateET, statusGroup } from "../../utils/slateDate.js";

function hasActiveGame(games) {
  return games.some((g) => {
    const group = statusGroup(g);
    return group === "live" || group === "scheduled";
  });
}

export function useSlateGames(league, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const slateDate = getSlateDateET();

  const query = useQuery({
    queryKey: queryKeys.leagueGames(league, null, slateDate),
    queryFn: ({ signal }) =>
      getLeagueGames(league, { date: slateDate, signal }),
    enabled,
    staleTime: 0,
  });

  // Backend returns either { games, resolvedDate, resolvedSeason } (when a
  // date is passed) or a plain array. Normalize.
  const raw = query.data;
  let games = [];
  let resolvedDate = null;
  if (raw && !Array.isArray(raw)) {
    games = raw.games ?? [];
    resolvedDate = raw.resolvedDate ?? null;
  } else if (Array.isArray(raw)) {
    games = raw;
  }

  // SSE subscription gated on active-or-upcoming games (live or scheduled today)
  // so a Scheduled game flips to In Progress without a manual refresh.
  const sseLeague = enabled && hasActiveGame(games) ? league : null;
  const { liveGamesMap } = useLiveGames(sseLeague);

  useEffect(() => {
    if (!liveGamesMap || liveGamesMap.size === 0 || !sseLeague) return;
    queryClient.setQueryData(
      queryKeys.leagueGames(league, null, slateDate),
      (prev) => {
        if (!prev) return prev;
        const arr = Array.isArray(prev) ? prev : prev.games ?? [];
        const merged = arr.map((g) =>
          liveGamesMap.has(g.id) ? { ...g, ...liveGamesMap.get(g.id) } : g
        );
        return Array.isArray(prev) ? merged : { ...prev, games: merged };
      },
    );
  }, [liveGamesMap, sseLeague, queryClient, league, slateDate]);

  // Refresh REST snapshot when the tab becomes visible again — covers stale
  // data after the OS suspended the SSE on a backgrounded PWA tab.
  useVisibilityReconnect(() => {
    if (enabled) query.refetch();
  }, enabled);

  return {
    games,
    resolvedDate,
    loading: query.isLoading,
    error: query.isError,
  };
}
