import { useQuery } from "@tanstack/react-query";
import { getSeasons } from "../../api/seasons.js";
import { queryKeys } from "../../lib/query.js";

export function useSeasons(league) {
  const { data: seasons = [] } = useQuery({
    queryKey: queryKeys.seasons(league),
    queryFn: ({ signal }) => getSeasons(league, { signal }),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
  return { seasons };
}
