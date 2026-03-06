import { apiFetch } from "./client.js";

export const getFavorites = ({ signal, token }) =>
  apiFetch("/api/favorites", { signal, token });

export const checkFavorites = ({ playerIds = [], teamIds = [], signal, token }) =>
  apiFetch("/api/favorites/check", {
    signal,
    token,
    params: {
      playerIds: playerIds.length ? playerIds.join(",") : undefined,
      teamIds: teamIds.length ? teamIds.join(",") : undefined,
    },
  });

export const addFavoritePlayer = (playerId, { token }) =>
  apiFetch(`/api/favorites/players/${playerId}`, { method: "POST", token });

export const removeFavoritePlayer = (playerId, { token }) =>
  apiFetch(`/api/favorites/players/${playerId}`, { method: "DELETE", token });

export const addFavoriteTeam = (teamId, { token }) =>
  apiFetch(`/api/favorites/teams/${teamId}`, { method: "POST", token });

export const removeFavoriteTeam = (teamId, { token }) =>
  apiFetch(`/api/favorites/teams/${teamId}`, { method: "DELETE", token });
