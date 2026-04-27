import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGameById } from "../../api/games.js";
import { useLiveGame } from "../live/useLiveGame.js";
import { queryKeys } from "../../lib/query.js";

function isLiveStatus(status) {
  return (
    typeof status === "string" &&
    (status.includes("In Progress") ||
      status.includes("End of Period") ||
      status.includes("Halftime"))
  );
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
  const isLive = isLiveStatus(gameStatus);
  const { liveData } = useLiveGame(league, gameId, isLive);

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
