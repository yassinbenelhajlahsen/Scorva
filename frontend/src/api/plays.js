import { apiFetch } from "./client.js";

export function getGamePlays(league, gameId, { signal } = {}) {
  return apiFetch(`/api/${league}/games/${gameId}/plays`, { signal });
}
