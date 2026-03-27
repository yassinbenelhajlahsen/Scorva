import { useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useChat } from "../context/ChatContext.jsx";
import { streamChatMessage } from "../api/chat.js";

const LEAGUES = ["nba", "nfl", "nhl"];

function getPageContext(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const league = LEAGUES.includes(parts[0]) ? parts[0] : null;
  if (!league) return null;

  if (parts[1] === "players" && parts[2]) {
    return { league, type: "player", playerSlug: parts[2] };
  }
  if (parts[1] === "teams" && parts[2]) {
    return { league, type: "team", teamSlug: parts[2] };
  }
  if (parts[1] === "games" && parts[2]) {
    return { league, type: "game", gameId: parseInt(parts[2], 10) };
  }
  return { league, type: "league" };
}

export function useChatActions() {
  const { session } = useAuth();
  const { setMessages, conversationId, setConversationId, setIsStreaming } = useChat();
  const location = useLocation();
  const abortRef = useRef(null);
  const cancelledRef = useRef(false);

  const sendMessage = useCallback(
    (text) => {
      if (!session || !text.trim()) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      cancelledRef.current = false;

      const pageContext = getPageContext(location.pathname);

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text.trim() },
        { role: "assistant", content: "" },
      ]);
      setIsStreaming(true);

      streamChatMessage({
        message: text.trim(),
        conversationId,
        pageContext,
        token: session.access_token,
        signal: controller.signal,
        onDelta: (delta) => {
          if (cancelledRef.current) return;
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.content += delta;
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onDone: (newConvoId) => {
          if (cancelledRef.current) return;
          setConversationId(newConvoId);
          setIsStreaming(false);
        },
        onError: (msg) => {
          if (cancelledRef.current) return;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: msg,
              isError: true,
            };
            return updated;
          });
          setIsStreaming(false);
        },
      });
    },
    [session, conversationId, location.pathname, setMessages, setConversationId, setIsStreaming]
  );

  const cancelStream = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") return prev.slice(0, -1);
      return prev;
    });
  }, [setIsStreaming, setMessages]);

  return { sendMessage, cancelStream };
}
