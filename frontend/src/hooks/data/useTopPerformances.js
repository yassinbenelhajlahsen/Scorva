import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";

export function useTopPerformances(league, { days = 7, type = "games", limit = 5 } = {}) {
  return useQuery({
    queryKey: queryKeys.topPerformances(league, days, type, limit),
    queryFn:  queryFns.topPerformances(league, days, type, limit),
    staleTime: 30_000,
    enabled: !!league,
  });
}
