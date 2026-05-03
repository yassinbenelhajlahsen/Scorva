import { apiFetch } from "./client.js";

export function getNews({ limit = 12, signal } = {}) {
  return apiFetch("/api/news", { signal, params: { limit } });
}
