import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../context/ChatContext.jsx", () => ({ useChat: vi.fn() }));
vi.mock("../../hooks/ai/useChatActions.js", () => ({ useChatActions: vi.fn() }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  m: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, whileHover, whileTap, ...props }) =>
          <div {...props}>{children}</div>,
    }
  ),
}));

const { useChat } = await import("../../context/ChatContext.jsx");
const { useChatActions } = await import("../../hooks/ai/useChatActions.js");
const ChatInput = (await import("../../components/chat/ChatInput.jsx")).default;

const mockSendMessage = vi.fn();
const mockCancelStream = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useChat.mockReturnValue({ isStreaming: false });
  useChatActions.mockReturnValue({ sendMessage: mockSendMessage, cancelStream: mockCancelStream });
});

describe("ChatInput", () => {
  it("renders the textarea with placeholder", () => {
    render(<ChatInput />);
    expect(screen.getByPlaceholderText(/Ask Sid/i)).toBeInTheDocument();
  });

  it("textarea is enabled when not streaming", () => {
    render(<ChatInput />);
    expect(screen.getByRole("textbox")).not.toBeDisabled();
  });

  it("textarea is disabled when streaming", () => {
    useChat.mockReturnValue({ isStreaming: true });
    render(<ChatInput />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows send button when text has content", () => {
    render(<ChatInput />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } });
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
  });

  it("does not show send button when text is empty", () => {
    render(<ChatInput />);
    expect(screen.queryByLabelText("Send message")).not.toBeInTheDocument();
  });

  it("shows stop button when streaming", () => {
    useChat.mockReturnValue({ isStreaming: true });
    render(<ChatInput />);
    expect(screen.getByLabelText("Stop generating")).toBeInTheDocument();
  });

  it("calls sendMessage on send button click", () => {
    render(<ChatInput />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello there" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(mockSendMessage).toHaveBeenCalledWith("Hello there");
  });

  it("clears text after sending", () => {
    render(<ChatInput />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(textarea.value).toBe("");
  });

  it("sends on Enter key (without Shift)", () => {
    render(<ChatInput />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockSendMessage).toHaveBeenCalledWith("Hello");
  });

  it("does not send on Shift+Enter", () => {
    render(<ChatInput />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("does not send when text is whitespace only", () => {
    render(<ChatInput />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("calls cancelStream when stop button is clicked", () => {
    useChat.mockReturnValue({ isStreaming: true });
    render(<ChatInput />);
    fireEvent.click(screen.getByLabelText("Stop generating"));
    expect(mockCancelStream).toHaveBeenCalledTimes(1);
  });
});
