import { useState, useEffect } from "react";
import { getSimilarPlayers } from "../../api/players.js";

export function useSimilarPlayers(league, slug, season) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!league || !slug || !season) return;

    const controller = new AbortController();
    setLoading(true);

    getSimilarPlayers(league, slug, { season, signal: controller.signal })
      .then((data) => {
        setPlayers(data.players ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setPlayers([]);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [league, slug, season]);

  return { players, loading };
}
