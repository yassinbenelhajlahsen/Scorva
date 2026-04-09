import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlayer } from "../../api/players.js";
import { queryKeys } from "../../lib/query.js";

export function usePlayer(league, slug, selectedSeason) {
  const {
    data: playerData = null,
    isLoading: loading,
    isFetching,
    isPlaceholderData,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.player(league, slug, selectedSeason),
    queryFn: ({ signal }) =>
      getPlayer(league, slug, { season: selectedSeason, signal }).then(
        (d) => d.player
      ),
    enabled: !!league && !!slug,
    // Only keep previous data when it's the same player (slug change = full reload)
    placeholderData: (prevData, prevQuery) => {
      const prevKey = prevQuery?.queryKey;
      if (prevKey && prevKey[1] === league && prevKey[2] === slug) {
        return prevData;
      }
      return undefined;
    },
  });

  const seasonLoading = isPlaceholderData && isFetching;
  const error = isError ? "Could not load player data. Please try again." : null;

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return { playerData, loading, seasonLoading, error, retry };
}
