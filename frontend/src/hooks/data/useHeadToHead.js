import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";

export function useHeadToHead(league, type, id1, id2) {
  const ids = [id1, id2].filter(Boolean);
  return useQuery({
    queryKey: queryKeys.headToHead(league, type, ids),
    queryFn: queryFns.headToHead(league, type, ids),
    enabled: ids.length === 2 && !!league && !!type,
    staleTime: 30 * 60 * 1000,
  });
}
