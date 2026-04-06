import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext.jsx";
import { getProfile } from "../../api/user.js";
import { queryKeys } from "../../lib/query.js";

export function useUserPrefs() {
  const { session } = useAuth();

  const { data: prefs = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.userPrefs(),
    queryFn: ({ signal }) =>
      getProfile({ token: session.access_token, signal }),
    enabled: !!session,
  });

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return { prefs, loading, refresh };
}
