import { useState, useEffect } from "react";
import { getAISummary } from "../../api/ai.js";
import { useAuth } from "../../context/AuthContext.jsx";

export function useAISummary(gameId) {
  const { session } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    if (session === undefined) return; // auth state still initializing
    if (!session) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchSummary() {
      try {
        setLoading(true);
        setError(false);
        const data = await getAISummary(gameId, {
          signal: controller.signal,
          token: session.access_token,
        });
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
  }, [gameId, session]);

  return { summary, loading, error };
}
