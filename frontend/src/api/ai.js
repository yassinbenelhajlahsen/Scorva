import { apiFetch } from "./client.js";

export function getAISummary(gameId, { signal } = {}) {
  return apiFetch(`/api/games/${gameId}/ai-summary`, { signal });
}
