import { useQuery } from "@tanstack/react-query";
import { getAISummary } from "../../api/ai.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { queryKeys } from "../../lib/query.js";

export function useAISummary(gameId) {
  const { session } = useAuth();

  const {
    data: summary = null,
    isLoading: queryLoading,
    isError: error,
  } = useQuery({
    queryKey: queryKeys.aiSummary(gameId),
    queryFn: ({ signal }) =>
      getAISummary(gameId, { signal, token: session.access_token }).then(
        (d) => d.summary
      ),
    enabled: !!gameId && session !== undefined && !!session,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  // Match original: on error, surface fallback text in summary
  const resolvedSummary = error
    ? "AI summary unavailable for this game."
    : summary;

  // loading=true while auth is still initializing, or while fetching
  const loading = session === undefined || (!!session && queryLoading);

  return { summary: resolvedSummary, loading, error };
}
