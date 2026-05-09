import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";

const TTL_BY_WINDOW = {
  today:  30 * 1000,
  week:   60 * 1000,
  month:  5 * 60 * 1000,
  season: 5 * 60 * 1000,
  all:    60 * 60 * 1000,
};

export function useTopPerformances(league, opts = {}) {
  const {
    type = "performances",
    window = "week",
    sort = "desc",
    position = "all",
    limit = 25,
    playerId,
  } = opts;
  const key = { type, window, sort, position, limit, playerId };
  return useQuery({
    queryKey: queryKeys.topPerformances(league, key),
    queryFn:  queryFns.topPerformances(league, key),
    staleTime: TTL_BY_WINDOW[window] ?? 60 * 1000,
    enabled: !!league,
  });
}
