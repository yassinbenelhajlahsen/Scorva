import { useState, useEffect } from "react";
import { getGamePrediction } from "../../api/games.js";

export function usePrediction(league, gameId, enabled) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    async function fetchPrediction() {
      setLoading(true);
      setError(false);
      try {
        const data = await getGamePrediction(league, gameId, {
          signal: controller.signal,
        });
        setPrediction(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPrediction();
    return () => controller.abort();
  }, [league, gameId, enabled]);

  return { prediction, loading, error };
}
