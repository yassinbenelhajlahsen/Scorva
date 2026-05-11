import { apiFetch } from "./client.js";

export function getTopPerformances(
  league,
  { type = "performances", entity, window = "week", sort = "desc", position = "all", limit = 25, playerId, teamId, fallback, season, signal } = {},
) {
  const params = { type, window, sort, position, limit };
  if (entity && entity !== "player") params.entity = entity;
  if (playerId) params.playerId = playerId;
  if (teamId) params.teamId = teamId;
  if (fallback) params.fallback = "true";
  if (season && window === "season") params.season = season;
  return apiFetch(`/api/${league}/top-performances`, { signal, params });
}
