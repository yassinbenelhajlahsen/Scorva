// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../components/settings/SettingsDrawer.jsx", () => ({
  default: ({ onClose }) => (
    <div data-testid="settings-drawer">
      <button data-testid="drawer-close" onClick={onClose}>
        close drawer
      </button>
    </div>
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  m: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, onClick, ...props }) =>
          (
            <div onClick={onClick} {...props}>
              {children}
            </div>
          ),
    }
  ),
}));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { SettingsProvider, useSettings } = await import("../../context/SettingsContext.jsx");

function TestConsumer() {
  const ctx = useSettings();
  return (
    <div>
      <span data-testid="dropdown-open">{String(ctx.isDropdownOpen)}</span>
      <span data-testid="drawer-open">{String(ctx.isDrawerOpen)}</span>
      <span data-testid="active-tab">{ctx.activeTab}</span>
      <button data-testid="toggle-dropdown" onClick={ctx.toggleDropdown}>
        toggle
      </button>
      <button data-testid="close-dropdown" onClick={ctx.closeDropdown}>
        close dropdown
      </button>
      <button data-testid="open-drawer" onClick={() => ctx.openDrawer()}>
        open drawer
      </button>
      <button data-testid="open-account" onClick={() => ctx.openDrawer("account")}>
        open account
      </button>
      <button data-testid="close-drawer" onClick={ctx.closeDrawer}>
        close drawer
      </button>
    </div>
  );
}

function renderProvider(session = { access_token: "tok" }) {
  useAuth.mockReturnValue({ session });
  return render(
    <SettingsProvider>
      <TestConsumer />
    </SettingsProvider>
  );
}

describe("SettingsProvider + useSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides default state values", () => {
    renderProvider();
    expect(screen.getByTestId("dropdown-open").textContent).toBe("false");
    expect(screen.getByTestId("drawer-open").textContent).toBe("false");
    expect(screen.getByTestId("active-tab").textContent).toBe("favorites");
  });

  it("toggleDropdown opens the dropdown", () => {
    renderProvider();
    fireEvent.click(screen.getByTestId("toggle-dropdown"));
    expect(screen.getByTestId("dropdown-open").textContent).toBe("true");
  });

  it("toggleDropdown closes an open dropdown", () => {
    renderProvider();
    fireEvent.click(screen.getByTestId("toggle-dropdown"));
    fireEvent.click(screen.getByTestId("toggle-dropdown"));
    expect(screen.getByTestId("dropdown-open").textContent).toBe("false");
  });

  it("closeDropdown closes the dropdown", () => {
    renderProvider();
    fireEvent.click(screen.getByTestId("toggle-dropdown"));
    fireEvent.click(screen.getByTestId("close-dropdown"));
    expect(screen.getByTestId("dropdown-open").textContent).toBe("false");
  });

  it("openDrawer opens the drawer with default favorites tab", () => {
    renderProvider();
    fireEvent.click(screen.getByTestId("open-drawer"));
    expect(screen.getByTestId("drawer-open").textContent).toBe("true");
    expect(screen.getByTestId("active-tab").textContent).toBe("favorites");
    expect(screen.getByTestId("settings-drawer")).toBeInTheDocument();
  });

  it("openDrawer opens the drawer with a specified tab", () => {
    renderProvider();
    fireEvent.click(screen.getByTestId("open-account"));
    expect(screen.getByTestId("drawer-open").textContent).toBe("true");
    expect(screen.getByTestId("active-tab").textContent).toBe("account");
  });

  it("openDrawer closes the dropdown", () => {
    renderProvider();
    fireEvent.click(screen.getByTestId("toggle-dropdown"));
    expect(screen.getByTestId("dropdown-open").textContent).toBe("true");
    fireEvent.click(screen.getByTestId("open-drawer"));
    expect(screen.getByTestId("dropdown-open").textContent).toBe("false");
  });

  it("closeDrawer closes the drawer and resets tab to favorites", () => {
    renderProvider();
    fireEvent.click(screen.getByTestId("open-account"));
    expect(screen.getByTestId("active-tab").textContent).toBe("account");

    fireEvent.click(screen.getByTestId("close-drawer"));
    expect(screen.getByTestId("drawer-open").textContent).toBe("false");
    expect(screen.getByTestId("active-tab").textContent).toBe("favorites");
  });

  it("auto-closes dropdown and drawer when session becomes null", () => {
    const { rerender } = renderProvider({ access_token: "tok" });
    fireEvent.click(screen.getByTestId("toggle-dropdown"));
    // openDrawer closes the dropdown and opens the drawer
    fireEvent.click(screen.getByTestId("open-drawer"));
    expect(screen.getByTestId("dropdown-open").textContent).toBe("false"); // openDrawer closes dropdown
    expect(screen.getByTestId("drawer-open").textContent).toBe("true");

    useAuth.mockReturnValue({ session: null });
    act(() => {
      rerender(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );
    });

    expect(screen.getByTestId("dropdown-open").textContent).toBe("false");
    expect(screen.getByTestId("drawer-open").textContent).toBe("false");
  });
});
