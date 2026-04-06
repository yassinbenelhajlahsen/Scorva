import { useState, useEffect } from "react";

export const queryKeys = {
  seasons:        (league) => ["seasons", league],
  gameDates:      (league, season) => ["gameDates", league, season],
  similarPlayers: (league, slug, season) => ["similarPlayers", league, slug, season],
  prediction:     (league, gameId) => ["prediction", league, gameId],
  aiSummary:      (gameId) => ["aiSummary", gameId],
  favorites:      () => ["favorites"],
  userPrefs:      () => ["userPrefs"],
  search:         (query) => ["search", query],
  winProbability: (league, eventId, isFinal) => ["winProbability", league, eventId, isFinal],
  plays:          (league, gameId) => ["plays", league, gameId],
  player:         (league, slug, season) => ["player", league, slug, season],
  team:           (league, teamId) => ["team", league, teamId],
  teamGames:      (league, teamId, season) => ["teamGames", league, teamId, season],
  teamSeasons:    (league, teamId) => ["teamSeasons", league, teamId],
  standings:      (league, season) => ["standings", league, season],
  leagueGames:    (league, season, date) => ["leagueGames", league, season, date],
  game:           (league, gameId) => ["game", league, gameId],
  homeGames:      () => ["homeGames"],
  favoriteCheck:  (type, id) => ["favoriteCheck", type, id],
};

export function useDebouncedValue(value, delay = 200) {
  // Initialize with "" so TQ doesn't fire immediately on mount
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
