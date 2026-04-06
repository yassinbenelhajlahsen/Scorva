import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  checkFavorites,
  addFavoritePlayer,
  removeFavoritePlayer,
  addFavoriteTeam,
  removeFavoriteTeam,
} from "../../api/favorites.js";
import { queryKeys } from "../../lib/query.js";

export function useFavoriteToggle(type, id) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Initial check query
  const { data: isFavorited = false } = useQuery({
    queryKey: queryKeys.favoriteCheck(type, id),
    queryFn: async ({ signal }) => {
      const params =
        type === "player"
          ? { playerIds: [id], signal, token: session.access_token }
          : { teamIds: [id], signal, token: session.access_token };
      const result = await checkFavorites(params);
      return type === "player"
        ? result.playerIds.includes(id)
        : result.teamIds.includes(id);
    },
    enabled: !!session && !!id,
  });

  // Toggle mutation — receives current isFavorited as argument so mutationFn
  // always operates on the value captured at toggle() time, not after onMutate
  // updates the cache (which would flip it before mutationFn reads it).
  const mutation = useMutation({
    mutationFn: async (currentIsFavorited) => {
      const token = session.access_token;
      if (currentIsFavorited) {
        if (type === "player") await removeFavoritePlayer(id, { token });
        else await removeFavoriteTeam(id, { token });
      } else {
        if (type === "player") await addFavoritePlayer(id, { token });
        else await addFavoriteTeam(id, { token });
      }
    },
    onMutate: async (currentIsFavorited) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.favoriteCheck(type, id),
      });
      const previous = queryClient.getQueryData(queryKeys.favoriteCheck(type, id));
      queryClient.setQueryData(queryKeys.favoriteCheck(type, id), !currentIsFavorited);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKeys.favoriteCheck(type, id), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites() });
    },
  });

  const toggle = useCallback(() => {
    if (!session || mutation.isPending) return;
    mutation.mutate(isFavorited);
  }, [session, mutation, isFavorited]);

  return { isFavorited, toggle, loading: mutation.isPending };
}
