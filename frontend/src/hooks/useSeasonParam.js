import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect } from "react";

// Reads ?season from the URL and manages updates.
// selectedSeason is null when no param is set (= max/current season).
// setSelectedSeason updates the URL with replace: true (no extra history entries).
// When seasons loads and the URL param equals the global current season, the param is removed.
// currentSeason: the global league current season (e.g. '2025-26'). Falls back to seasons[0]
// when not provided. Pass it explicitly when seasons may be player/team-specific (e.g. an
// injured player whose availableSeasons[0] differs from the league's current season).
export function useSeasonParam(seasons, currentSeason = null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSeason = searchParams.get("season") || null;

  const isCurrentSeason = useCallback(
    (season) => {
      const ref = currentSeason ?? (seasons.length > 0 ? seasons[0] : null);
      return ref !== null && season === ref;
    },
    [currentSeason, seasons],
  );

  const setSelectedSeason = useCallback(
    (season) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!season || isCurrentSeason(season)) {
            next.delete("season");
          } else {
            next.set("season", season);
          }
          return next;
        },
        { replace: true },
      );
    },
    [isCurrentSeason, setSearchParams],
  );

  // Cleanup: if seasons has loaded and the URL param equals the global current season, remove it.
  // This handles the case where someone navigates to ?season=<current-season>.
  useEffect(() => {
    if (selectedSeason && isCurrentSeason(selectedSeason)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("season");
          return next;
        },
        { replace: true },
      );
    }
  }, [seasons, currentSeason]); // eslint-disable-line react-hooks/exhaustive-deps

  return [selectedSeason, setSelectedSeason];
}
