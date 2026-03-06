import { useState, useEffect } from "react";
import { getGameById } from "../api/games.js";

export function useGame(league, gameId) {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchGame() {
      setLoading(true);
      setError(false);
      try {
        const data = await getGameById(league, gameId, { signal: controller.signal });
        setGameData(data);
        setLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching game:", err);
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchGame();
    return () => controller.abort();
  }, [league, gameId]);

  return { gameData, loading, error };
}
