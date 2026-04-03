import { useState, useEffect, useRef } from "react";
import { search } from "../../api/search.js";

export function useSearch(query, debounceMs = 200) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      setLoading(true);
      try {
        const data = await search(trimmed, { signal: abortControllerRef.current.signal });
        setResults(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Search error:", err);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return { results, loading };
}
