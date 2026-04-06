import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGamePlays } from "../../api/plays.js";
import { queryKeys } from "../../lib/query.js";

export function usePlays(league, gameId) {
  const {
    data: plays = null,
    isLoading: loading,
    isError: error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.plays(league, gameId),
    queryFn: async ({ signal }) => {
      try {
        return await getGamePlays(league, gameId, { signal });
      } catch (err) {
        if (err.message === "HTTP 404") return { plays: [] };
        throw err;
      }
    },
    staleTime: 0,
  });

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return { plays, loading, error, retry };
}
