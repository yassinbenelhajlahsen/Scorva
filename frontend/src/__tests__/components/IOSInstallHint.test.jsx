// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const MOTION_PROPS = new Set([
  "animate", "initial", "exit", "transition", "whileHover", "whileTap",
]);

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: (_, tag) => {
        const El = ({ children, className, onClick, style, ...rest }) => {
          const Tag = tag;
          const props = Object.fromEntries(
            Object.entries(rest).filter(([k]) => !MOTION_PROPS.has(k))
          );
          return (
            <Tag className={className} onClick={onClick} style={style} {...props}>
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

vi.mock("../../hooks/useStandalone.js", () => ({
  useStandalone: vi.fn(),
}));

vi.mock("../../lib/pwaVisitTracking.js", () => ({
  getVisitCount: vi.fn(),
  trackVisit: vi.fn(),
}));

import { useStandalone } from "../../hooks/useStandalone.js";
import { getVisitCount } from "../../lib/pwaVisitTracking.js";
import IOSInstallHint from "../../components/pwa/IOSInstallHint.jsx";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("IOSInstallHint", () => {
  it("renders nothing on non-iOS browsers", () => {
    useStandalone.mockReturnValue({ isIOS: false, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(5);
    const { container } = render(<IOSInstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on iOS Chrome (not Safari)", () => {
    useStandalone.mockReturnValue({ isIOS: true, isSafari: false, isStandalone: false });
    getVisitCount.mockReturnValue(5);
    const { container } = render(<IOSInstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when already installed (standalone)", () => {
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: true });
    getVisitCount.mockReturnValue(5);
    const { container } = render(<IOSInstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when previously dismissed", () => {
    localStorage.setItem("scorva:ios-install-dismissed", "1");
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(5);
    const { container } = render(<IOSInstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it("shows immediately when visit count >= 2", () => {
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(2);
    render(<IOSInstallHint />);
    expect(screen.getByText(/Install Scorva/i)).toBeInTheDocument();
  });

  it("waits 30 seconds when visit count is 1", async () => {
    vi.useFakeTimers();
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(1);

    render(<IOSInstallHint />);
    expect(screen.queryByText(/Install Scorva/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText(/Install Scorva/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("dismisses on close click and persists to localStorage", () => {
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(2);
    render(<IOSInstallHint />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(localStorage.getItem("scorva:ios-install-dismissed")).toBe("1");
    expect(screen.queryByText(/Install Scorva/i)).not.toBeInTheDocument();
  });
});
