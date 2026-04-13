// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: () =>
        ({ children, className }) => (
          <span data-testid="dot" className={className}>
            {children}
          </span>
        ),
    }
  ),
}));

const ChatTypingIndicator = (await import("../../../components/chat/ChatTypingIndicator.jsx")).default;

describe("ChatTypingIndicator", () => {
  it("renders three animated dots", () => {
    render(<ChatTypingIndicator />);

    const dots = screen.getAllByTestId("dot");
    expect(dots).toHaveLength(3);
  });

  it("renders inside a flex container", () => {
    const { container } = render(<ChatTypingIndicator />);

    const wrapper = container.firstChild;
    expect(wrapper.className).toContain("flex");
  });
});
