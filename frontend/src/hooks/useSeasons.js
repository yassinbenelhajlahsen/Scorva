import { useState, useEffect } from "react";
import { getSeasons } from "../api/seasons.js";

export function useSeasons(league) {
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    getSeasons(league, { signal: controller.signal })
      .then(setSeasons)
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Error fetching seasons:", err);
      });

    return () => controller.abort();
  }, [league]);

  return { seasons };
}
