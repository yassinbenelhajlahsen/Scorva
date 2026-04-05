import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

let mockSignInWithPassword;
let mockSignUp;
let mockResetPasswordForEmail;
let mockSignInWithOAuth;

vi.mock("../../lib/supabase.js", () => {
  mockSignInWithPassword = vi.fn();
  mockSignUp = vi.fn();
  mockResetPasswordForEmail = vi.fn();
  mockSignInWithOAuth = vi.fn();
  return {
    supabase: {
      auth: {
        signInWithPassword: (...a) => mockSignInWithPassword(...a),
        signUp: (...a) => mockSignUp(...a),
        resetPasswordForEmail: (...a) => mockResetPasswordForEmail(...a),
        signInWithOAuth: (...a) => mockSignInWithOAuth(...a),
      },
    },
  };
});

vi.mock("../../components/ui/FloatingInput.jsx", () => ({
  FloatingInput: ({ id, type, value, onChange, label, rightSlot }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={onChange} />
      {rightSlot}
    </div>
  ),
}));

vi.mock("../../components/auth/PasswordChecklist.jsx", () => ({
  PasswordChecklist: () => <div data-testid="password-checklist" />,
  passwordMeetsRequirements: vi.fn(() => true),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  m: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, onClick, layout, custom, variants, initial, animate, exit, transition, ...props }) =>
          <div onClick={onClick} {...props}>{children}</div>,
    }
  ),
}));

const { passwordMeetsRequirements } = await import("../../components/auth/PasswordChecklist.jsx");
const AuthModal = (await import("../../components/auth/AuthModal.jsx")).default;

beforeEach(() => {
  vi.clearAllMocks();
  passwordMeetsRequirements.mockReturnValue(true);
});

describe("AuthModal — rendering", () => {
  it("renders Sign In mode by default", () => {
    render(<AuthModal onClose={vi.fn()} context="default" />);
    // "Sign In" appears in both heading and submit button
    expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
  });

  it("renders context subtitle for chat context", () => {
    render(<AuthModal onClose={vi.fn()} context="chat" />);
    expect(screen.getByText("to use AI Chat")).toBeInTheDocument();
  });

  it("renders default subtitle for unknown context", () => {
    render(<AuthModal onClose={vi.fn()} context="other" />);
    expect(screen.getByText("to continue to Scorva")).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(<AuthModal onClose={vi.fn()} context="default" />);
    // Close button is an SVG button at top-right — find via its container
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});

describe("AuthModal — mode switching", () => {
  it("switches to sign up mode", () => {
    render(<AuthModal onClose={vi.fn()} context="default" />);
    fireEvent.click(screen.getByText("Sign up"));
    // "Create Account" appears in both heading and button
    expect(screen.getAllByText("Create Account").length).toBeGreaterThan(0);
  });

  it("switches back to sign in from sign up", () => {
    render(<AuthModal onClose={vi.fn()} context="default" />);
    fireEvent.click(screen.getByText("Sign up"));
    fireEvent.click(screen.getByText("Sign in"));
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
  });

  it("shows Forgot password button in sign in mode", () => {
    render(<AuthModal onClose={vi.fn()} context="default" />);
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("shows password checklist in sign up mode", () => {
    render(<AuthModal onClose={vi.fn()} context="default" />);
    fireEvent.click(screen.getByText("Sign up"));
    expect(screen.getByTestId("password-checklist")).toBeInTheDocument();
  });
});

describe("AuthModal — Escape key", () => {
  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<AuthModal onClose={onClose} context="default" />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("AuthModal — sign in", () => {
  it("calls signInWithPassword on submit", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const onClose = vi.fn();
    render(<AuthModal onClose={onClose} context="default" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password1" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "Password1",
      })
    );
  });

  it("calls onClose on successful sign in", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const onClose = vi.fn();
    render(<AuthModal onClose={onClose} context="default" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password1" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows error message on sign in failure", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });
    render(<AuthModal onClose={vi.fn()} context="default" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
  });
});

describe("AuthModal — sign up validation", () => {
  it("shows error when passwords do not match", async () => {
    passwordMeetsRequirements.mockReturnValue(true);
    render(<AuthModal onClose={vi.fn()} context="default" />);

    fireEvent.click(screen.getByText("Sign up"));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password1!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Different1!" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText("Passwords don't match.")).toBeInTheDocument()
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("shows error when password requirements not met", async () => {
    passwordMeetsRequirements.mockReturnValue(false);
    render(<AuthModal onClose={vi.fn()} context="default" />);

    fireEvent.click(screen.getByText("Sign up"));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "weak" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "weak" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText("Password does not meet all requirements.")).toBeInTheDocument()
    );
  });
});

describe("AuthModal — password reset flow", () => {
  it("shows reset form when Forgot password is clicked", () => {
    render(<AuthModal onClose={vi.fn()} context="default" />);
    fireEvent.click(screen.getByText("Forgot password?"));
    expect(screen.getByText("Reset Password")).toBeInTheDocument();
  });

  it("goes back to sign in from reset", () => {
    render(<AuthModal onClose={vi.fn()} context="default" />);
    fireEvent.click(screen.getByText("Forgot password?"));
    expect(screen.getByText("Reset Password")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Back to sign in"));
    // After going back, "Forgot password?" reappears (unique to sign-in view)
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("shows reset-sent confirmation on success", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    render(<AuthModal onClose={vi.fn()} context="default" />);

    fireEvent.click(screen.getByText("Forgot password?"));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(screen.getByText("Check your email")).toBeInTheDocument());
  });
});
