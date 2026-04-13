// @vitest-environment jsdom
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

  it("renders statusText below typing indicator when streaming with no content and statusText set", () => {
    render(
      <MessageBubble role="assistant" content="" isStreaming={true} statusText="Checking standings" />
    );

    expect(screen.getByTestId("typing-indicator")).toBeInTheDocument();
    expect(screen.getByText("Checking standings")).toBeInTheDocument();
  });

  it("does not render statusText when content is present", () => {
    render(
      <MessageBubble role="assistant" content="Answer here" isStreaming={true} statusText="Checking standings" />
    );

    expect(screen.queryByText("Checking standings")).not.toBeInTheDocument();
    expect(screen.getByText("Answer here")).toBeInTheDocument();
  });

  it("does not render statusText when not streaming", () => {
    render(
      <MessageBubble role="assistant" content="" isStreaming={false} statusText="Checking standings" />
    );

    expect(screen.queryByText("Checking standings")).not.toBeInTheDocument();
  });

  it("does not render statusText when statusText is null", () => {
    render(
      <MessageBubble role="assistant" content="" isStreaming={true} statusText={null} />
    );

    expect(screen.getByTestId("typing-indicator")).toBeInTheDocument();
    // No status text rendered
    expect(screen.queryByText(/checking/i)).not.toBeInTheDocument();
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

  it("renders an unordered list from - prefixed lines", () => {
    render(
      <MessageBubble
        role="assistant"
        content={"- LeBron James\n- Stephen Curry\n- Kevin Durant"}
        isStreaming={false}
      />
    );

    const list = document.querySelector("ul");
    expect(list).toBeInTheDocument();
    const items = document.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe("LeBron James");
    expect(items[1].textContent).toBe("Stephen Curry");
    expect(items[2].textContent).toBe("Kevin Durant");
  });

  it("renders a numbered list from 1. prefixed lines", () => {
    render(
      <MessageBubble
        role="assistant"
        content={"1. First pick\n2. Second pick\n3. Third pick"}
        isStreaming={false}
      />
    );

    const list = document.querySelector("ol");
    expect(list).toBeInTheDocument();
    const items = document.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe("First pick");
  });

  it("renders a short intro paragraph followed by a bullet list", () => {
    render(
      <MessageBubble
        role="assistant"
        content={"Top scorers this week:\n- LeBron: 32 pts\n- Curry: 29 pts"}
        isStreaming={false}
      />
    );

    expect(screen.getByText("Top scorers this week:")).toBeInTheDocument();
    const items = document.querySelectorAll("li");
    expect(items).toHaveLength(2);
  });

  it("renders bold text inside a list item", () => {
    render(
      <MessageBubble
        role="assistant"
        content={"- **LeBron** scored 28\n- **Curry** hit 7 threes"}
        isStreaming={false}
      />
    );

    const strongs = document.querySelectorAll("strong");
    expect(strongs).toHaveLength(2);
    expect(strongs[0].textContent).toBe("LeBron");
    expect(strongs[1].textContent).toBe("Curry");
  });

  it("wraps content in chat-markdown div", () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Hello world" isStreaming={false} />
    );

    expect(container.querySelector(".chat-markdown")).toBeInTheDocument();
  });

  it("renders blank-line-separated text as separate paragraph blocks", () => {
    render(
      <MessageBubble
        role="assistant"
        content={"First paragraph.\n\nSecond paragraph."}
        isStreaming={false}
      />
    );

    const paragraphs = document.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe("First paragraph.");
    expect(paragraphs[1].textContent).toBe("Second paragraph.");
  });
});
