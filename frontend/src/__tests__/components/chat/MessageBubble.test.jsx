import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: () =>
        ({ children, className, ...rest }) => (
          <div className={className} {...rest}>
            {children}
          </div>
        ),
    }
  ),
}));

vi.mock("../../../components/chat/ChatTypingIndicator.jsx", () => ({
  default: () => <div data-testid="typing-indicator" />,
}));

// Import after mocking to get the correct path relative to test
const MessageBubble = (await import("../../../components/chat/MessageBubble.jsx")).default;

describe("MessageBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user message content", () => {
    render(<MessageBubble role="user" content="Hello there!" isStreaming={false} />);

    expect(screen.getByText("Hello there!")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    render(<MessageBubble role="assistant" content="LeBron is great." isStreaming={false} />);

    expect(screen.getByText("LeBron is great.")).toBeInTheDocument();
  });

  it("renders bold text from **markdown** syntax", () => {
    render(<MessageBubble role="assistant" content="He scored **28 points** tonight." isStreaming={false} />);

    const bold = screen.getByText("28 points");
    expect(bold.tagName).toBe("STRONG");
  });

  it("renders plain text without markdown transformation", () => {
    render(<MessageBubble role="user" content="No bold here" isStreaming={false} />);

    expect(screen.getByText("No bold here")).toBeInTheDocument();
    expect(screen.queryByRole("strong")).not.toBeInTheDocument();
  });

  it("shows typing indicator when isStreaming and content is empty", () => {
    render(<MessageBubble role="assistant" content="" isStreaming={true} />);

    expect(screen.getByTestId("typing-indicator")).toBeInTheDocument();
  });

  it("does not show typing indicator when content is present", () => {
    render(<MessageBubble role="assistant" content="Answer coming..." isStreaming={true} />);

    expect(screen.queryByTestId("typing-indicator")).not.toBeInTheDocument();
    expect(screen.getByText("Answer coming...")).toBeInTheDocument();
  });

  it("does not show typing indicator when not streaming even if content is empty", () => {
    render(<MessageBubble role="assistant" content="" isStreaming={false} />);

    expect(screen.queryByTestId("typing-indicator")).not.toBeInTheDocument();
  });

  it("applies error styling when isError is true", () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Error occurred." isError={true} isStreaming={false} />
    );

    expect(container.innerHTML).toContain("border-loss");
  });

  it("renders multiple bold sections in one message", () => {
    render(
      <MessageBubble
        role="assistant"
        content="**LeBron** scored **28 points** tonight."
        isStreaming={false}
      />
    );

    const strongs = document.querySelectorAll("strong");
    expect(strongs).toHaveLength(2);
    expect(strongs[0].textContent).toBe("LeBron");
    expect(strongs[1].textContent).toBe("28 points");
  });
});
