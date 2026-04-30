import { useQueries, useQuery } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";

const EMPTY = Object.freeze({});

const STALE = 60 * 60 * 1000;
const GC = 24 * 60 * 60 * 1000;

export function useDuplicatePlayerSlugs(league) {
  const { data } = useQuery({
    queryKey: queryKeys.duplicatePlayerSlugs(league),
    queryFn: queryFns.duplicatePlayerSlugs(league),
    enabled: !!league,
    staleTime: STALE,
    gcTime: GC,
  });
  return data || EMPTY;
}

const ALL_LEAGUES = ["nba", "nfl", "nhl"];

export function useDuplicatePlayerSlugsAll({ enabled = true } = {}) {
  const results = useQueries({
    queries: ALL_LEAGUES.map((league) => ({
      queryKey: queryKeys.duplicatePlayerSlugs(league),
      queryFn: queryFns.duplicatePlayerSlugs(league),
      enabled,
      staleTime: STALE,
      gcTime: GC,
    })),
  });
  const out = {};
  ALL_LEAGUES.forEach((league, i) => {
    out[league] = results[i].data || EMPTY;
  });
  return out;
}
