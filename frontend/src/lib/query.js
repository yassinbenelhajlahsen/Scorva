import { useState, useEffect } from "react";
import { getGameById, getLeagueGames, getGameDates, getAllLeagueGames } from "../api/games.js";
import { getPlayer } from "../api/players.js";
import { getTeams } from "../api/teams.js";
import { getNews } from "../api/news.js";
import { getHeadToHead } from "../api/compare.js";
import slugify from "../utils/slugify.js";

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
  news:           () => ["news"],
  headToHead:     (league, type, ids) => ["headToHead", league, type, ...ids],
  playoffs:       (league, season) => ["playoffs", league, season],
};

export const queryFns = {
  game: (league, gameId) => () => getGameById(league, gameId),
  player: (league, slug, season) => () =>
    getPlayer(league, slug, { season }).then((d) => d.player),
  team: (league, teamSlug) => () =>
    getTeams(league).then((teamList) => {
      const found = teamList.find(
        (t) =>
          slugify(t.name) === teamSlug ||
          slugify(t.shortname || "") === teamSlug
      );
      if (!found) throw new Error("Team not found.");
      return found;
    }),
  leagueGames: (league, season, date) => () =>
    getLeagueGames(league, { season, date }),
  gameDates: (league, season) => () => getGameDates(league, { season }),
  homeGames: () => () => getAllLeagueGames(),
  news: () => () => getNews(),
  headToHead: (league, type, ids) => () =>
    getHeadToHead(league, type, ids).then((d) => d.games),
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
