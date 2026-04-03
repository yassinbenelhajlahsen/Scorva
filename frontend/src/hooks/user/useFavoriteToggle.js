import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  checkFavorites,
  addFavoritePlayer,
  removeFavoritePlayer,
  addFavoriteTeam,
  removeFavoriteTeam,
} from "../../api/favorites.js";

export function useFavoriteToggle(type, id) {
  const { session } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session || !id) return;
    const controller = new AbortController();
    const params =
      type === "player"
        ? { playerIds: [id], signal: controller.signal, token: session.access_token }
        : { teamIds: [id], signal: controller.signal, token: session.access_token };
    checkFavorites(params)
      .then((result) => {
        if (type === "player") {
          setIsFavorited(result.playerIds.includes(id));
        } else {
          setIsFavorited(result.teamIds.includes(id));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [session, type, id]);

  async function toggle() {
    if (!session || loading) return;
    setLoading(true);
    const token = session.access_token;
    try {
      if (isFavorited) {
        setIsFavorited(false);
        if (type === "player") await removeFavoritePlayer(id, { token });
        else await removeFavoriteTeam(id, { token });
      } else {
        setIsFavorited(true);
        if (type === "player") await addFavoritePlayer(id, { token });
        else await addFavoriteTeam(id, { token });
      }
    } catch {
      setIsFavorited((prev) => !prev);
    } finally {
      setLoading(false);
    }
  }

  return { isFavorited, toggle, loading };
}
