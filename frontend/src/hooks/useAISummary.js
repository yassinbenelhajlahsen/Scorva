import { useState, useEffect } from "react";
import { getAISummary } from "../api/ai.js";

export function useAISummary(gameId) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    const controller = new AbortController();

    async function fetchSummary() {
      try {
        setLoading(true);
        setError(false);
        const data = await getAISummary(gameId, { signal: controller.signal });
        setSummary(data.summary);
        setLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching AI summary:", err);
          setError(true);
          setSummary("AI summary unavailable for this game.");
          setLoading(false);
        }
      }
    }

    fetchSummary();
    return () => controller.abort();
  }, [gameId]);

  return { summary, loading, error };
}
