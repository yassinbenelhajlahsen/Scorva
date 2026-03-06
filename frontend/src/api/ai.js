import { apiFetch } from "./client.js";

export function getAISummary(gameId, { signal, token } = {}) {
  return apiFetch(`/api/games/${gameId}/ai-summary`, { signal, token });
}
