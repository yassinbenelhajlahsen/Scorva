import { useState, useEffect } from "react";
import { getPlayer } from "../api/players.js";

export function usePlayer(league, slug, selectedSeason) {
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPlayerData() {
      setLoading(true);
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
          setLoading(false);
        }
      }
    }

    fetchPlayerData();
    return () => controller.abort();
  }, [league, slug, selectedSeason]);

  return { playerData, loading };
}
