import { useQuery } from "@tanstack/react-query";
import { getStreak } from "../../api/streaks.js";
import { queryKeys } from "../../lib/query.js";

export function useStreak(league, subjectType, subjectId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: queryKeys.streak(league, subjectType, subjectId),
    queryFn: ({ signal }) => getStreak(league, subjectType, subjectId, { signal }),
    enabled: !!league && !!subjectType && subjectId != null && enabled,
    staleTime: 30_000,
  });
  return {
    streak: query.data?.streak ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
