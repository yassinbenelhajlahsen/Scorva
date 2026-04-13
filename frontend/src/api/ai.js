import { apiFetch } from "./client.js";

const BASE = import.meta.env.VITE_API_URL;

export function getAISummary(gameId, { signal, token } = {}) {
  return apiFetch(`/api/games/${gameId}/ai-summary`, { signal, token });
}

export function streamAISummary(gameId, { token, signal, onBullet, onFull, onDone, onError } = {}) {
  fetch(`${BASE}/api/games/${gameId}/ai-summary`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        onError?.(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "bullet") onBullet?.(event.text);
            else if (event.type === "full") onFull?.(event.summary, event.cached);
            else if (event.type === "done") onDone?.();
            else if (event.type === "error") onError?.(event.message);
          } catch {
            // skip malformed lines
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError?.("Connection lost. Please try again.");
      }
    });
}
