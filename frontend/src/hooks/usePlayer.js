import { useState, useEffect, useCallback } from "react";
import { getPlayer } from "../api/players.js";

export function usePlayer(league, slug, selectedSeason) {
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPlayerData() {
      setLoading(true);
      setError(null);
      try {
        const fullData = await getPlayer(league, slug, {
          season: selectedSeason,
          signal: controller.signal,
        });
        setPlayerData(fullData.player);
        setLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching player:", err);
          setPlayerData(null);
          setError("Could not load player data. Please try again.");
          setLoading(false);
        }
      }
    }

    fetchPlayerData();
    return () => controller.abort();
  }, [league, slug, selectedSeason, retryCount]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { playerData, loading, error, retry };
}
