import { useState, useEffect, useRef } from "react";
import { streamAISummary } from "../../api/ai.js";
import { useAuth } from "../../context/AuthContext.jsx";

function parseBulletPoints(text) {
  if (!text) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, ""))
    .filter((line) => line.length > 0);
}

export function useAISummary(gameId) {
  const { session } = useAuth();
  const [bullets, setBullets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Auth not yet resolved
    if (session === undefined) return;
    // Not logged in — nothing to fetch
    if (!session || !gameId) {
      setLoading(false);
      return;
    }

    setBullets([]);
    setLoading(true);
    setError(null);
    setCached(null);

    abortRef.current = new AbortController();

    streamAISummary(gameId, {
      token: session.access_token,
      signal: abortRef.current.signal,
      onBullet: (text) => {
        setBullets((prev) => [...prev, text]);
      },
      onFull: (summary, isCached) => {
        setBullets(parseBulletPoints(summary));
        setCached(isCached ?? false);
      },
      onDone: () => {
        setLoading(false);
      },
      onError: (msg) => {
        setError(msg || "AI summary unavailable for this game.");
        setLoading(false);
      },
    });

    return () => {
      abortRef.current?.abort();
    };
  }, [gameId, session]);

  return { bullets, loading, error, cached };
}
