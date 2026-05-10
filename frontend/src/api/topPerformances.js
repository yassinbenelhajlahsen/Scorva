import { apiFetch } from "./client.js";

export function getTopPerformances(
  league,
  { type = "performances", window = "week", sort = "desc", position = "all", limit = 25, playerId, fallback, signal } = {},
) {
  const params = { type, window, sort, position, limit };
  if (playerId) params.playerId = playerId;
  if (fallback) params.fallback = "true";
  return apiFetch(`/api/${league}/top-performances`, {
    signal,
    params,
  });
}
