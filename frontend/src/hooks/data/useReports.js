import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";

export function useReports({ league, type, limit = 20, offset = 0 } = {}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.reports(league, type, limit, offset),
    queryFn: queryFns.reports(league, type, limit, offset),
    staleTime: 60 * 1000,
  });

  return {
    reports: data?.reports ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    loading: isLoading,
    error: isError,
    refetch,
  };
}
