import { useQuery } from "@tanstack/react-query";
import { getGameDates } from "../../api/games.js";
import { queryKeys } from "../../lib/query.js";

export function useGameDates(league, season) {
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.gameDates(league, season),
    queryFn: ({ signal }) =>
      getGameDates(league, { season: season || undefined, signal }),
    staleTime: 10 * 60 * 1000,
    select: (raw) => ({
      dates: raw.map((d) => d.date),
      gameCounts: new Map(raw.map((d) => [d.date, d.count])),
    }),
  });
  return {
    dates: data?.dates ?? [],
    gameCounts: data?.gameCounts ?? new Map(),
    loading,
    refetch,
  };
}
