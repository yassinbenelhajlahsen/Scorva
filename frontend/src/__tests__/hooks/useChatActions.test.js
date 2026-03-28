import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../context/ChatContext.jsx", () => ({
  useChat: vi.fn(),
}));

vi.mock("../../api/chat.js", () => ({
  streamChatMessage: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useLocation: vi.fn(),
}));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { useChat } = await import("../../context/ChatContext.jsx");
const { streamChatMessage } = await import("../../api/chat.js");
const { useLocation } = await import("react-router-dom");
const { useChatActions } = await import("../../hooks/useChatActions.js");

const mockSession = { access_token: "tok-123", user: { id: "u1" } };

function makeSetMessages() {
  let messages = [];
  const setMessages = vi.fn((updater) => {
    if (typeof updater === "function") {
      messages = updater(messages);
    } else {
      messages = updater;
    }
  });
  setMessages.getMessages = () => messages;
  return setMessages;
}

describe("useChatActions", () => {
  let setMessages;
  let setConversationId;
  let setIsStreaming;

  beforeEach(() => {
    vi.clearAllMocks();
    setMessages = makeSetMessages();
    setConversationId = vi.fn();
    setIsStreaming = vi.fn();

    useAuth.mockReturnValue({ session: mockSession });
    useChat.mockReturnValue({
      setMessages,
      conversationId: null,
      setConversationId,
      setIsStreaming,
    });
    useLocation.mockReturnValue({ pathname: "/nba" });
    streamChatMessage.mockImplementation(() => {});
  });

  describe("sendMessage", () => {
    it("does nothing when session is null", () => {
      useAuth.mockReturnValue({ session: null });

      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      expect(setMessages).not.toHaveBeenCalled();
    });

    it("does nothing when text is empty", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage(""));

      expect(setMessages).not.toHaveBeenCalled();
    });

    it("does nothing when text is only whitespace", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("   "));

      expect(setMessages).not.toHaveBeenCalled();
    });

    it("adds user message and empty assistant message", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      const msgs = setMessages.getMessages();
      expect(msgs).toHaveLength(2);
      expect(msgs[0]).toMatchObject({ role: "user", content: "Hello" });
      expect(msgs[1]).toMatchObject({ role: "assistant", content: "" });
    });

    it("sets isStreaming to true", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      expect(setIsStreaming).toHaveBeenCalledWith(true);
    });

    it("calls streamChatMessage with correct params", () => {
      useChat.mockReturnValue({
        setMessages,
        conversationId: "conv-1",
        setConversationId,
        setIsStreaming,
      });

      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("How is LeBron?"));

      expect(streamChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "How is LeBron?",
          conversationId: "conv-1",
          token: "tok-123",
          pageContext: expect.objectContaining({ type: "league", league: "nba" }),
        })
      );
    });

    it("trims whitespace from text before sending", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("  Hello  "));

      const msgs = setMessages.getMessages();
      expect(msgs[0].content).toBe("Hello");
    });
  });

  describe("getPageContext (via sendMessage)", () => {
    it("extracts player context from /nba/players/lebron-james", () => {
      useLocation.mockReturnValue({ pathname: "/nba/players/lebron-james" });

      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Stats?"));

      const ctx = streamChatMessage.mock.calls[0][0].pageContext;
      expect(ctx).toEqual({ league: "nba", type: "player", playerSlug: "lebron-james" });
    });

    it("extracts team context from /nfl/teams/kansas-city-chiefs", () => {
      useLocation.mockReturnValue({ pathname: "/nfl/teams/kansas-city-chiefs" });

      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Record?"));

      const ctx = streamChatMessage.mock.calls[0][0].pageContext;
      expect(ctx).toEqual({ league: "nfl", type: "team", teamSlug: "kansas-city-chiefs" });
    });

    it("extracts game context from /nhl/games/123", () => {
      useLocation.mockReturnValue({ pathname: "/nhl/games/123" });

      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Recap?"));

      const ctx = streamChatMessage.mock.calls[0][0].pageContext;
      expect(ctx).toEqual({ league: "nhl", type: "game", gameId: 123 });
    });

    it("extracts league context from /nba", () => {
      useLocation.mockReturnValue({ pathname: "/nba" });

      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Standings?"));

      const ctx = streamChatMessage.mock.calls[0][0].pageContext;
      expect(ctx).toEqual({ league: "nba", type: "league" });
    });

    it("returns null context from non-league paths like /about", () => {
      useLocation.mockReturnValue({ pathname: "/about" });

      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello?"));

      const ctx = streamChatMessage.mock.calls[0][0].pageContext;
      expect(ctx).toBeNull();
    });

    it("returns null context from root path /", () => {
      useLocation.mockReturnValue({ pathname: "/" });

      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello?"));

      const ctx = streamChatMessage.mock.calls[0][0].pageContext;
      expect(ctx).toBeNull();
    });
  });

  describe("onDelta callback", () => {
    it("appends delta content to the last assistant message", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      const onDelta = streamChatMessage.mock.calls[0][0].onDelta;
      act(() => onDelta("LeBron is great!"));

      const msgs = setMessages.getMessages();
      expect(msgs[msgs.length - 1].content).toBe("LeBron is great!");
    });
  });

  describe("onDone callback", () => {
    it("sets conversationId and stops streaming", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      const onDone = streamChatMessage.mock.calls[0][0].onDone;
      act(() => onDone("new-conv-id"));

      expect(setConversationId).toHaveBeenCalledWith("new-conv-id");
      expect(setIsStreaming).toHaveBeenCalledWith(false);
    });
  });

  describe("onError callback", () => {
    it("replaces last message with error and stops streaming", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      const onError = streamChatMessage.mock.calls[0][0].onError;
      act(() => onError("Something went wrong."));

      const msgs = setMessages.getMessages();
      expect(msgs[msgs.length - 1]).toMatchObject({
        role: "assistant",
        content: "Something went wrong.",
        isError: true,
      });
      expect(setIsStreaming).toHaveBeenCalledWith(false);
    });
  });

  describe("onStatus callback", () => {
    it("sets statusText on the last assistant message", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      const onStatus = streamChatMessage.mock.calls[0][0].onStatus;
      act(() => onStatus("Checking standings"));

      const msgs = setMessages.getMessages();
      expect(msgs[msgs.length - 1].statusText).toBe("Checking standings");
    });

    it("clears statusText to null when onDelta fires", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      const { onStatus, onDelta } = streamChatMessage.mock.calls[0][0];
      act(() => onStatus("Fetching player stats"));
      act(() => onDelta("LeBron is"));

      const msgs = setMessages.getMessages();
      expect(msgs[msgs.length - 1].statusText).toBeNull();
    });

    it("is gated by cancelledRef (not called after cancel)", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      const onStatus = streamChatMessage.mock.calls[0][0].onStatus;
      act(() => result.current.cancelStream());

      // Reset call count to detect new setMessages calls
      setMessages.mockClear();
      act(() => onStatus("Checking standings"));

      // setMessages should NOT have been called after cancel
      expect(setMessages).not.toHaveBeenCalled();
    });
  });

  describe("cancelStream", () => {
    it("sets isStreaming to false", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.cancelStream());

      expect(setIsStreaming).toHaveBeenCalledWith(false);
    });

    it("removes trailing empty assistant message", () => {
      // First send a message to get user + empty assistant into state
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));

      // Now cancel — should remove the empty assistant
      act(() => result.current.cancelStream());

      const msgs = setMessages.getMessages();
      // Only the user message should remain (assistant was removed)
      expect(msgs.find((m) => m.role === "assistant" && m.content === "")).toBeUndefined();
    });

    it("does not remove user messages", () => {
      const { result } = renderHook(() => useChatActions());
      act(() => result.current.sendMessage("Hello"));
      act(() => result.current.cancelStream());

      const msgs = setMessages.getMessages();
      expect(msgs.find((m) => m.role === "user")).toBeDefined();
    });
  });
});
