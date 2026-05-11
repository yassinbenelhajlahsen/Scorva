import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllLeagueGames } from "../../api/games.js";
import { useLiveGames } from "../live/useLiveGames.js";
import { useVisibilityReconnect } from "../live/useVisibilityReconnect.js";
import { queryKeys } from "../../lib/query.js";

function hasActiveGame(games) {
  return games.some((g) => {
    const s = g.status ?? "";
    const isTerminal =
      s.includes("Final") ||
      s.includes("Postponed") ||
      s.includes("Canceled") ||
      s.includes("Cancelled") ||
      s.includes("Suspended");
    return !isTerminal && s.length > 0;
  });
}

function mergeByMap(arr, map) {
  if (!map || map.size === 0) return arr;
  return arr.map((g) => (map.has(g.id) ? { ...g, ...map.get(g.id) } : g));
}

export function useHomeGames() {
  const queryClient = useQueryClient();

  const {
    data: games = { nba: [], nhl: [], nfl: [] },
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.homeGames(),
    queryFn: ({ signal }) => getAllLeagueGames(signal),
    staleTime: 0,
  });

  const { liveGamesMap: liveNbaMap } = useLiveGames(hasActiveGame(games.nba) ? "nba" : null);
  const { liveGamesMap: liveNhlMap } = useLiveGames(hasActiveGame(games.nhl) ? "nhl" : null);
  const { liveGamesMap: liveNflMap } = useLiveGames(hasActiveGame(games.nfl) ? "nfl" : null);

  useEffect(() => {
    if (!liveNbaMap && !liveNhlMap && !liveNflMap) return;
    queryClient.setQueryData(queryKeys.homeGames(), (prev) => {
      if (!prev) return prev;
      return {
        nba: mergeByMap(prev.nba, liveNbaMap),
        nhl: mergeByMap(prev.nhl, liveNhlMap),
        nfl: mergeByMap(prev.nfl, liveNflMap),
      };
    });
  }, [liveNbaMap, liveNhlMap, liveNflMap, queryClient]);

  useVisibilityReconnect(() => {
    refetch();
  });

  const error = isError ? "Could not load games. Please try again later." : null;

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return { games, loading, error, retry, refetch };
}
