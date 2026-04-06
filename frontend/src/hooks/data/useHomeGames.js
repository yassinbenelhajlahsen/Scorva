import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllLeagueGames } from "../../api/games.js";
import { useLiveGames } from "../live/useLiveGames.js";
import { queryKeys } from "../../lib/query.js";

function hasLiveGame(games) {
  return games.some(
    (g) =>
      g.status.includes("In Progress") ||
      g.status.includes("End of Period") ||
      g.status.includes("Halftime")
  );
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

  const { liveGames: liveNba } = useLiveGames(hasLiveGame(games.nba) ? "nba" : null);
  const { liveGames: liveNhl } = useLiveGames(hasLiveGame(games.nhl) ? "nhl" : null);
  const { liveGames: liveNfl } = useLiveGames(hasLiveGame(games.nfl) ? "nfl" : null);

  // Push SSE updates into the query cache
  useEffect(() => {
    if (!liveNba && !liveNhl && !liveNfl) return;
    queryClient.setQueryData(queryKeys.homeGames(), (prev) => ({
      nba: liveNba ?? prev?.nba ?? [],
      nhl: liveNhl ?? prev?.nhl ?? [],
      nfl: liveNfl ?? prev?.nfl ?? [],
    }));
  }, [liveNba, liveNhl, liveNfl, queryClient]);

  const error = isError ? "Could not load games. Please try again later." : null;

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return { games, loading, error, retry };
}
