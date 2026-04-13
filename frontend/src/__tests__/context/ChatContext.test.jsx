// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../context/SettingsContext.jsx", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../../components/chat/ChatFAB.jsx", () => ({
  default: ({ onClick, isOpen }) => (
    <button data-testid="chat-fab" onClick={onClick}>
      {isOpen ? "close" : "open"}
    </button>
  ),
}));

vi.mock("../../components/chat/ChatPanel.jsx", () => ({
  default: ({ onClose }) => (
    <div data-testid="chat-panel">
      <button onClick={onClose}>close panel</button>
    </div>
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  m: new Proxy({}, { get: () => ({ children, ...props }) => <div {...props}>{children}</div> }),
}));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { useSettings } = await import("../../context/SettingsContext.jsx");
const { ChatProvider, useChat } = await import("../../context/ChatContext.jsx");

function TestConsumer() {
  const ctx = useChat();
  return (
    <div>
      <span data-testid="is-open">{String(ctx.isOpen)}</span>
      <span data-testid="msg-count">{ctx.messages.length}</span>
      <span data-testid="conv-id">{ctx.conversationId ?? "null"}</span>
      <span data-testid="is-streaming">{String(ctx.isStreaming)}</span>
      <button data-testid="toggle" onClick={ctx.togglePanel}>toggle</button>
      <button data-testid="reset" onClick={ctx.resetConversation}>reset</button>
      <button
        data-testid="add-msg"
        onClick={() => ctx.setMessages([{ role: "user", content: "hi" }])}
      >
        add msg
      </button>
      <button
        data-testid="set-conv"
        onClick={() => ctx.setConversationId("conv-1")}
      >
        set conv
      </button>
    </div>
  );
}

function renderProvider(session = { access_token: "tok" }) {
  useAuth.mockReturnValue({ session, openAuthModal: vi.fn() });
  useSettings.mockReturnValue({ isDrawerOpen: false });
  return render(
    <ChatProvider>
      <TestConsumer />
    </ChatProvider>
  );
}

describe("ChatProvider + useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides default state values", () => {
    renderProvider();

    expect(screen.getByTestId("is-open").textContent).toBe("false");
    expect(screen.getByTestId("msg-count").textContent).toBe("0");
    expect(screen.getByTestId("conv-id").textContent).toBe("null");
    expect(screen.getByTestId("is-streaming").textContent).toBe("false");
  });

  it("togglePanel opens the panel when session exists", () => {
    renderProvider({ access_token: "tok" });

    fireEvent.click(screen.getByTestId("toggle"));

    expect(screen.getByTestId("is-open").textContent).toBe("true");
  });

  it("togglePanel calls openAuthModal when session is null", () => {
    const openAuthModal = vi.fn();
    useAuth.mockReturnValue({ session: null, openAuthModal });

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    fireEvent.click(screen.getByTestId("toggle"));

    expect(openAuthModal).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("is-open").textContent).toBe("false");
  });

  it("hides ChatFAB when settings drawer is open", () => {
    useAuth.mockReturnValue({ session: { access_token: "tok" }, openAuthModal: vi.fn() });
    useSettings.mockReturnValue({ isDrawerOpen: true });
    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );
    expect(screen.queryByTestId("chat-fab")).not.toBeInTheDocument();
  });

  it("resetConversation clears messages and conversationId", () => {
    renderProvider();

    fireEvent.click(screen.getByTestId("add-msg"));
    fireEvent.click(screen.getByTestId("set-conv"));
    expect(screen.getByTestId("msg-count").textContent).toBe("1");
    expect(screen.getByTestId("conv-id").textContent).toBe("conv-1");

    fireEvent.click(screen.getByTestId("reset"));

    expect(screen.getByTestId("msg-count").textContent).toBe("0");
    expect(screen.getByTestId("conv-id").textContent).toBe("null");
  });

  it("renders ChatFAB when session is defined (not undefined)", () => {
    renderProvider({ access_token: "tok" });

    expect(screen.getByTestId("chat-fab")).toBeInTheDocument();
  });

  it("does not render ChatFAB when session is undefined", () => {
    useAuth.mockReturnValue({ session: undefined, openAuthModal: vi.fn() });

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    expect(screen.queryByTestId("chat-fab")).not.toBeInTheDocument();
  });

  it("renders ChatPanel when panel is open", () => {
    renderProvider();

    fireEvent.click(screen.getByTestId("toggle"));

    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("does not render ChatPanel when panel is closed", () => {
    renderProvider();

    expect(screen.queryByTestId("chat-panel")).not.toBeInTheDocument();
  });
});
