import { apiFetch } from "./client.js";

export function getStreak(league, subjectType, subjectId, { signal } = {}) {
  if (subjectType === "player") {
    return apiFetch(`/api/${league}/players/${subjectId}/streak`, { signal });
  }
  return apiFetch(`/api/${league}/teams/${subjectId}/streak`, { signal });
}
