import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGameById } from "../../api/games.js";
import { useLiveGame } from "../live/useLiveGame.js";
import { queryKeys } from "../../lib/query.js";

function isActiveStatus(status) {
  if (typeof status !== "string" || status.length === 0) return false;
  const isFinal =
    status.includes("Final") ||
    status.includes("Postponed") ||
    status.includes("Canceled") ||
    status.includes("Cancelled") ||
    status.includes("Suspended");
  return !isFinal;
}

export function useGame(league, gameId) {
  const queryClient = useQueryClient();

  const {
    data: gameData = null,
    isLoading: loading,
    isError: error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.game(league, gameId),
    queryFn: ({ signal }) => getGameById(league, gameId, { signal }),
    staleTime: 0,
  });

  const gameStatus = gameData?.json_build_object?.game?.status;
  const isActive = isActiveStatus(gameStatus);
  const { liveData } = useLiveGame(league, gameId, isActive);

  // Push SSE data into the query cache and trigger plays refresh
  useEffect(() => {
    if (liveData) {
      queryClient.setQueryData(queryKeys.game(league, gameId), liveData);
      queryClient.invalidateQueries({ queryKey: queryKeys.plays(league, gameId) });
    }
  }, [liveData, queryClient, league, gameId]);

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return { gameData, loading, error, retry, refetch };
}
