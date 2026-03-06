import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getProfile } from "../api/user.js";

export function useUserPrefs() {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(() => {
    if (!session) return;
    const controller = new AbortController();
    setLoading(true);
    getProfile({ token: session.access_token })
      .then((data) => { setPrefs(data); setLoading(false); })
      .catch((err) => { if (err.name !== "AbortError") setLoading(false); });
    return controller;
  }, [session]);

  useEffect(() => {
    const controller = fetch();
    return () => controller?.abort();
  }, [fetch]);

  return { prefs, loading, refresh: fetch };
}
