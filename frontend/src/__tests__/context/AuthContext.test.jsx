// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

let mockOnAuthStateChange;
let mockUnsubscribe;
let mockGetSession;

vi.mock("../../lib/supabase.js", () => {
  mockUnsubscribe = vi.fn();
  mockOnAuthStateChange = vi.fn(() => ({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  }));
  // Default: never settles, mirroring an unreachable auth host
  mockGetSession = vi.fn(() => new Promise(() => {}));
  return {
    supabase: {
      auth: {
        onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
        getSession: (...args) => mockGetSession(...args),
      },
    },
  };
});

vi.mock("../../components/auth/AuthModal.jsx", () => ({
  default: ({ context, onClose }) => (
    <div data-testid="auth-modal" data-context={context}>
      <button data-testid="modal-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  m: new Proxy({}, { get: () => ({ children, ...props }) => <div {...props}>{children}</div> }),
}));

const { AuthProvider, useAuth } = await import("../../context/AuthContext.jsx");

function TestConsumer() {
  const { session, openAuthModal } = useAuth();
  return (
    <div>
      <span data-testid="session">{session === undefined ? "undefined" : session === null ? "null" : "set"}</span>
      <button data-testid="open-modal" onClick={() => openAuthModal()}>
        open default
      </button>
      <button data-testid="open-modal-context" onClick={() => openAuthModal("sign-up")}>
        open sign-up
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe("AuthProvider + useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock so fresh calls work
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
    mockGetSession.mockReturnValue(new Promise(() => {}));
  });

  it("provides undefined session initially", () => {
    renderProvider();
    expect(screen.getByTestId("session").textContent).toBe("undefined");
  });

  it("updates session when onAuthStateChange fires", () => {
    renderProvider();

    const callback = mockOnAuthStateChange.mock.calls[0][0];
    act(() => {
      callback("SIGNED_IN", { access_token: "tok123" });
    });

    expect(screen.getByTestId("session").textContent).toBe("set");
  });

  it("sets session to null on sign-out", () => {
    renderProvider();

    const callback = mockOnAuthStateChange.mock.calls[0][0];
    act(() => {
      callback("SIGNED_OUT", null);
    });

    expect(screen.getByTestId("session").textContent).toBe("null");
  });

  it("opens auth modal with default context", () => {
    renderProvider();

    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("open-modal"));

    expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
    expect(screen.getByTestId("auth-modal").dataset.context).toBe("default");
  });

  it("opens auth modal with custom context", () => {
    renderProvider();

    fireEvent.click(screen.getByTestId("open-modal-context"));

    expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
    expect(screen.getByTestId("auth-modal").dataset.context).toBe("sign-up");
  });

  it("closes modal when onClose is called", () => {
    renderProvider();

    fireEvent.click(screen.getByTestId("open-modal"));
    expect(screen.getByTestId("auth-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("modal-close"));

    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
  });

  it("subscribes to auth state changes on mount", () => {
    renderProvider();
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderProvider();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("resolves session from getSession when the subscription has not fired", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "tok123" } } });
    renderProvider();

    await act(async () => {});

    expect(screen.getByTestId("session").textContent).toBe("set");
  });

  it("commits null when getSession resolves with no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderProvider();

    await act(async () => {});

    expect(screen.getByTestId("session").textContent).toBe("null");
  });

  it("commits null when getSession rejects", async () => {
    mockGetSession.mockRejectedValue(new Error("Failed to fetch"));
    renderProvider();

    await act(async () => {});

    expect(screen.getByTestId("session").textContent).toBe("null");
  });

  it("commits null after the init timeout when auth never resolves", () => {
    vi.useFakeTimers();
    try {
      renderProvider();
      expect(screen.getByTestId("session").textContent).toBe("undefined");

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId("session").textContent).toBe("null");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not override a real session with the timeout fallback", () => {
    vi.useFakeTimers();
    try {
      renderProvider();

      const callback = mockOnAuthStateChange.mock.calls[0][0];
      act(() => {
        callback("SIGNED_IN", { access_token: "tok123" });
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId("session").textContent).toBe("set");
    } finally {
      vi.useRealTimers();
    }
  });

  it("still applies a later auth event after the timeout fallback", () => {
    vi.useFakeTimers();
    try {
      renderProvider();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId("session").textContent).toBe("null");

      const callback = mockOnAuthStateChange.mock.calls[0][0];
      act(() => {
        callback("SIGNED_IN", { access_token: "tok123" });
      });

      expect(screen.getByTestId("session").textContent).toBe("set");
    } finally {
      vi.useRealTimers();
    }
  });
});
