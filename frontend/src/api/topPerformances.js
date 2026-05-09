import { apiFetch } from "./client.js";

export function getTopPerformances(
  league,
  { type = "performances", window = "week", sort = "desc", position = "all", limit = 25, signal } = {},
) {
  return apiFetch(`/api/${league}/top-performances`, {
    signal,
    params: { type, window, sort, position, limit },
  });
}
