import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../context/ChatContext.jsx", () => ({
  useChat: vi.fn(),
}));

vi.mock("../../../components/chat/MessageBubble.jsx", () => ({
  default: ({ role, content, isStreaming, isError }) => (
    <div
      data-testid="message-bubble"
      data-role={role}
      data-content={content}
      data-streaming={String(isStreaming)}
      data-error={String(!!isError)}
    />
  ),
}));

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: (_, tag) =>
        ({ children, className, onClick, ...props }) => (
          <div className={className} onClick={onClick}>{children}</div>
        ),
    }
  ),
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// ChatMessages imports useChat from a path relative to its own location
// We need to re-mock using the same path that ChatMessages uses
vi.mock("../../../context/ChatContext.jsx", () => ({
  useChat: vi.fn(),
}));

const { useChat } = await import("../../../context/ChatContext.jsx");
const ChatMessages = (await import("../../../components/chat/ChatMessages.jsx")).default;

describe("ChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  describe("empty state", () => {
    beforeEach(() => {
      useChat.mockReturnValue({ messages: [], isStreaming: false });
    });

    it("shows 'Ask me anything' heading", () => {
      render(<ChatMessages onSuggest={vi.fn()} />);

      expect(screen.getByText("Ask me anything")).toBeInTheDocument();
    });

    it("renders all three suggestion buttons", () => {
      render(<ChatMessages onSuggest={vi.fn()} />);

      expect(screen.getByText("Who leads the NBA in scoring this season?")).toBeInTheDocument();
      expect(screen.getByText("How have the Celtics been playing lately?")).toBeInTheDocument();
      expect(screen.getByText("Compare LeBron James and Stephen Curry")).toBeInTheDocument();
    });

    it("calls onSuggest with the suggestion text when clicked", () => {
      const onSuggest = vi.fn();
      render(<ChatMessages onSuggest={onSuggest} />);

      fireEvent.click(screen.getByText("Who leads the NBA in scoring this season?"));

      expect(onSuggest).toHaveBeenCalledWith("Who leads the NBA in scoring this season?");
    });

    it("does not render any MessageBubble in empty state", () => {
      render(<ChatMessages onSuggest={vi.fn()} />);

      expect(screen.queryByTestId("message-bubble")).not.toBeInTheDocument();
    });
  });

  describe("message list", () => {
    it("renders a MessageBubble for each message", () => {
      useChat.mockReturnValue({
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
        isStreaming: false,
      });

      render(<ChatMessages onSuggest={vi.fn()} />);

      const bubbles = screen.getAllByTestId("message-bubble");
      expect(bubbles).toHaveLength(2);
    });

    it("passes isStreaming=true to the last assistant bubble only", () => {
      useChat.mockReturnValue({
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "" },
        ],
        isStreaming: true,
      });

      render(<ChatMessages onSuggest={vi.fn()} />);

      const bubbles = screen.getAllByTestId("message-bubble");
      expect(bubbles[0].dataset.streaming).toBe("false"); // user message
      expect(bubbles[1].dataset.streaming).toBe("true");  // last assistant
    });

    it("passes isStreaming=false to non-last messages", () => {
      useChat.mockReturnValue({
        messages: [
          { role: "user", content: "Q1" },
          { role: "assistant", content: "A1" },
          { role: "user", content: "Q2" },
          { role: "assistant", content: "" },
        ],
        isStreaming: true,
      });

      render(<ChatMessages onSuggest={vi.fn()} />);

      const bubbles = screen.getAllByTestId("message-bubble");
      // Only last bubble gets isStreaming=true
      expect(bubbles[0].dataset.streaming).toBe("false");
      expect(bubbles[1].dataset.streaming).toBe("false");
      expect(bubbles[2].dataset.streaming).toBe("false");
      expect(bubbles[3].dataset.streaming).toBe("true");
    });

    it("passes isError to MessageBubble", () => {
      useChat.mockReturnValue({
        messages: [{ role: "assistant", content: "Error msg", isError: true }],
        isStreaming: false,
      });

      render(<ChatMessages onSuggest={vi.fn()} />);

      const bubble = screen.getByTestId("message-bubble");
      expect(bubble.dataset.error).toBe("true");
    });

    it("does not show suggestion buttons when messages exist", () => {
      useChat.mockReturnValue({
        messages: [{ role: "user", content: "Hello" }],
        isStreaming: false,
      });

      render(<ChatMessages onSuggest={vi.fn()} />);

      expect(screen.queryByText("Ask me anything")).not.toBeInTheDocument();
    });
  });
});
