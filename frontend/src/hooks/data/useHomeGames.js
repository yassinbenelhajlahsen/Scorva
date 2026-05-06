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

  const { liveGames: liveNba } = useLiveGames(hasActiveGame(games.nba) ? "nba" : null);
  const { liveGames: liveNhl } = useLiveGames(hasActiveGame(games.nhl) ? "nhl" : null);
  const { liveGames: liveNfl } = useLiveGames(hasActiveGame(games.nfl) ? "nfl" : null);

  // Push SSE updates into the query cache
  useEffect(() => {
    if (!liveNba && !liveNhl && !liveNfl) return;
    queryClient.setQueryData(queryKeys.homeGames(), (prev) => ({
      nba: liveNba ?? prev?.nba ?? [],
      nhl: liveNhl ?? prev?.nhl ?? [],
      nfl: liveNfl ?? prev?.nfl ?? [],
    }));
  }, [liveNba, liveNhl, liveNfl, queryClient]);

  // Refresh REST snapshot when the tab becomes visible again — covers stale
  // data after the OS suspended the SSE on a backgrounded PWA tab.
  useVisibilityReconnect(() => {
    refetch();
  });

  const error = isError ? "Could not load games. Please try again later." : null;

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return { games, loading, error, retry, refetch };
}
