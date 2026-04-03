import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getFavorites } from "../../api/favorites.js";

export function useFavorites() {
  const { session } = useAuth();
  const [favorites, setFavorites] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(() => {
    if (!session) return;
    const controller = new AbortController();
    setLoading(true);
    getFavorites({ signal: controller.signal, token: session.access_token })
      .then((data) => {
        setFavorites(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoading(false);
      });
    return controller;
  }, [session]);

  useEffect(() => {
    const controller = fetch();
    return () => controller?.abort();
  }, [fetch]);

  return { favorites, loading, refresh: fetch };
}
