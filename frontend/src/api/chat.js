const BASE = import.meta.env.VITE_API_URL;
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

export function streamChatMessage({
  message,
  conversationId,
  pageContext,
  token,
  onDelta,
  onDone,
  onError,
  onStatus,
  signal,
}) {
  fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, conversationId, pageContext }),
    signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(data.error || `Request failed (${res.status})`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > MAX_BUFFER_SIZE) {
          reader.cancel();
          onError("Response too large. Please try again.");
          return;
        }

        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "delta") onDelta(event.content);
            else if (event.type === "status") onStatus?.(event.content);
            else if (event.type === "done") onDone(event.conversationId);
            else if (event.type === "error") onError(event.message);
          } catch {
            // skip malformed lines
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError("Connection lost. Please try again.");
      }
    });
}
