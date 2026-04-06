import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext.jsx";
import { getFavorites } from "../../api/favorites.js";
import { queryKeys } from "../../lib/query.js";

export function useFavorites() {
  const { session } = useAuth();

  const { data: favorites = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.favorites(),
    queryFn: ({ signal }) =>
      getFavorites({ signal, token: session.access_token }),
    enabled: !!session,
  });

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return { favorites, loading, refresh };
}
