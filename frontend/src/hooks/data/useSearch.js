import { useQuery } from "@tanstack/react-query";
import { search } from "../../api/search.js";
import { queryKeys, useDebouncedValue } from "../../lib/query.js";

export function useSearch(query, debounceMs = 200) {
  const debouncedQuery = useDebouncedValue(query.trim(), debounceMs);

  const { data: results = [], isFetching } = useQuery({
    queryKey: queryKeys.search(debouncedQuery),
    queryFn: ({ signal }) => search(debouncedQuery, { signal }),
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
    gcTime: 2 * 60 * 1000,
  });

  // Clear results immediately when query is empty (don't wait for debounce)
  const trimmed = query.trim();

  // Show loading when query is non-empty and debounce hasn't settled or fetch is in-flight
  const loading =
    trimmed.length > 0 && (trimmed !== debouncedQuery || isFetching);

  return { results: trimmed.length > 0 ? results : [], loading };
}
