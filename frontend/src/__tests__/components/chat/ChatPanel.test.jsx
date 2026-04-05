import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../context/ChatContext.jsx", () => ({
  useChat: vi.fn(),
}));

vi.mock("../../../hooks/ai/useChatActions.js", () => ({
  useChatActions: vi.fn(),
}));

vi.mock("../../../components/chat/ChatMessages.jsx", () => ({
  default: () => <div data-testid="chat-messages" />,
}));

vi.mock("../../../components/chat/ChatInput.jsx", () => ({
  default: () => <div data-testid="chat-input" />,
}));

const MOTION_PROPS = new Set([
  "animate", "initial", "exit", "transition", "whileHover", "whileTap",
]);

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: (_, tag) => {
        const El = ({ children, className, onClick, ...rest }) => {
          const Tag = tag;
          const props = Object.fromEntries(
            Object.entries(rest).filter(([k]) => !MOTION_PROPS.has(k))
          );
          return (
            <Tag className={className} onClick={onClick} {...props}>
              {children}
            </Tag>
          );
        };
        El.displayName = tag;
        return El;
      },
    }
  ),
  useAnimation: () => ({ set: vi.fn(), start: vi.fn() }),
}));

const { useChat } = await import("../../../context/ChatContext.jsx");
const { useChatActions } = await import("../../../hooks/ai/useChatActions.js");
const ChatPanel = (await import("../../../components/chat/ChatPanel.jsx")).default;

describe("ChatPanel", () => {
  let resetConversation;
  let sendMessage;

  beforeEach(() => {
    vi.clearAllMocks();
    resetConversation = vi.fn();
    sendMessage = vi.fn();

    useChat.mockReturnValue({ resetConversation, isStreaming: false, messages: [] });
    useChatActions.mockReturnValue({ sendMessage });
  });

  it("renders header with 'Sid' title", () => {
    render(<ChatPanel onClose={vi.fn()} />);

    expect(screen.getByText("Sid")).toBeInTheDocument();
  });

  it("renders new conversation button", () => {
    render(<ChatPanel onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "New conversation" })).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(<ChatPanel onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Close chat" })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<ChatPanel onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls resetConversation when reset button is clicked (not streaming)", () => {
    render(<ChatPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));

    expect(resetConversation).toHaveBeenCalledTimes(1);
  });

  it("disables reset button while streaming", () => {
    useChat.mockReturnValue({ resetConversation, isStreaming: true, messages: [] });

    render(<ChatPanel onClose={vi.fn()} />);

    const resetBtn = screen.getByRole("button", { name: "New conversation" });
    expect(resetBtn).toBeDisabled();
  });

  it("does not call resetConversation when streaming and reset clicked", () => {
    useChat.mockReturnValue({ resetConversation, isStreaming: true, messages: [] });

    render(<ChatPanel onClose={vi.fn()} />);

    // disabled button shouldn't trigger click
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));

    expect(resetConversation).not.toHaveBeenCalled();
  });

  it("renders footer disclaimer text", () => {
    render(<ChatPanel onClose={vi.fn()} />);

    expect(screen.getByText(/AI-generated/)).toBeInTheDocument();
    expect(screen.getByText(/verify important stats/)).toBeInTheDocument();
  });

  it("renders ChatMessages and ChatInput", () => {
    render(<ChatPanel onClose={vi.fn()} />);

    expect(screen.getByTestId("chat-messages")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });
});
