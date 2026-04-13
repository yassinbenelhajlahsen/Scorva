// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
  AnimatePresence: ({ children }) => <>{children}</>,
}));

const ChatFAB = (await import("../../../components/chat/ChatFAB.jsx")).default;

describe("ChatFAB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 'Open AI chat' aria-label when closed", () => {
    render(<ChatFAB onClick={vi.fn()} isOpen={false} />);

    expect(screen.getByRole("button", { name: "Open AI chat" })).toBeInTheDocument();
  });

  it("renders with 'Close AI chat' aria-label when open", () => {
    render(<ChatFAB onClick={vi.fn()} isOpen={true} />);

    expect(screen.getByRole("button", { name: "Close AI chat" })).toBeInTheDocument();
  });

  it("calls onClick when button is clicked", () => {
    const onClick = vi.fn();
    render(<ChatFAB onClick={onClick} isOpen={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Open AI chat" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows chat icon SVG when closed", () => {
    const { container } = render(<ChatFAB onClick={vi.fn()} isOpen={false} />);

    // The chat bubble path
    expect(container.querySelector("path[d*='21 15']")).toBeInTheDocument();
  });

  it("shows close (X) icon SVG when open", () => {
    const { container } = render(<ChatFAB onClick={vi.fn()} isOpen={true} />);

    // The X lines
    expect(container.querySelector("line[x1='4'][y1='4']")).toBeInTheDocument();
  });
});
