import { useState, useEffect, useCallback } from "react";
import { getPlayer } from "../../api/players.js";

export function usePlayer(league, slug, selectedSeason) {
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Clear stale player data and show full skeleton when navigating to a new player.
  useEffect(() => {
    setPlayerData(null);
    setLoading(true);
    setError(null);
  }, [league, slug]);

  // Fetch on any dep change. Uses prev playerData to decide full load vs season merge.
  useEffect(() => {
    const controller = new AbortController();
    setSeasonLoading(true);
    setError(null);

    async function fetchPlayerData() {
      try {
        const fullData = await getPlayer(league, slug, {
          season: selectedSeason,
          signal: controller.signal,
        });

        setPlayerData((prev) =>
          prev
            ? {
                ...prev,
                season: fullData.player.season,
                team: fullData.player.team,
                seasonAverages: fullData.player.seasonAverages,
                games: fullData.player.games,
              }
            : fullData.player
        );
        setLoading(false);
        setSeasonLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching player:", err);
          setPlayerData(null);
          setError("Could not load player data. Please try again.");
          setLoading(false);
          setSeasonLoading(false);
        }
      }
    }

    fetchPlayerData();
    return () => controller.abort();
  }, [league, slug, selectedSeason, retryCount]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setRetryCount((c) => c + 1);
  }, []);

  return { playerData, loading, seasonLoading, error, retry };
}
