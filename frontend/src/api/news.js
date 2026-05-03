import { apiFetch } from "./client.js";

export function getNews({ limit = 10, signal } = {}) {
  return apiFetch("/api/news", { signal, params: { limit } });
}
