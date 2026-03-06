import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Mock useAuth so we control session state
vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

// Mock useSearch to avoid real API calls
vi.mock("../../hooks/useSearch.js", () => ({
  useSearch: vi.fn(() => ({ results: [], loading: false })),
}));

// Mock SearchBar to keep tests focused on Navbar
vi.mock("../../components/ui/SearchBar.jsx", () => ({
  default: () => <input placeholder="Search" />,
}));

const { useAuth } = await import("../../context/AuthContext.jsx");
const Navbar = (await import("../../components/layout/Navbar.jsx")).default;

function renderNavbar() {
  return render(
    <BrowserRouter>
      <Navbar />
    </BrowserRouter>
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Scorva brand link", () => {
    useAuth.mockReturnValue({ session: null, openAuthModal: vi.fn() });
    renderNavbar();
    expect(screen.getByText("Scorva")).toBeInTheDocument();
  });

  it("renders all league and about links", () => {
    useAuth.mockReturnValue({ session: null, openAuthModal: vi.fn() });
    renderNavbar();
    expect(screen.getByText("NBA")).toBeInTheDocument();
    expect(screen.getByText("NFL")).toBeInTheDocument();
    expect(screen.getByText("NHL")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("shows Sign In button when session is null", () => {
    useAuth.mockReturnValue({ session: null, openAuthModal: vi.fn() });
    renderNavbar();
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("shows Account link when session is active", () => {
    useAuth.mockReturnValue({
      session: { access_token: "tok", user: { id: "u1" } },
      openAuthModal: vi.fn(),
    });
    renderNavbar();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
  });

  it("hides auth section when session is undefined (loading)", () => {
    useAuth.mockReturnValue({ session: undefined, openAuthModal: vi.fn() });
    renderNavbar();
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
  });
});
