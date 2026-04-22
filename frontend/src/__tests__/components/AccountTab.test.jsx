// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));

let mockUpdateUser;
let mockSignInWithPassword;
let mockSignOut;

vi.mock("../../lib/supabase.js", () => {
  mockUpdateUser = vi.fn();
  mockSignInWithPassword = vi.fn();
  mockSignOut = vi.fn();
  return {
    supabase: {
      auth: {
        updateUser: (...a) => mockUpdateUser(...a),
        signInWithPassword: (...a) => mockSignInWithPassword(...a),
        signOut: (...a) => mockSignOut(...a),
      },
    },
  };
});

vi.mock("../../api/user.js", () => ({
  updateProfile: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("../../components/ui/FloatingInput.jsx", () => ({
  FloatingInput: ({ id, type, value, onChange, label }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={onChange} />
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
        ({ children, initial, animate, exit, ...props }) =>
          <div {...props}>{children}</div>,
    }
  ),
}));

const { useAuth } = await import("../../context/AuthContext.jsx");
const { updateProfile, deleteAccount } = await import("../../api/user.js");
const { passwordMeetsRequirements } = await import("../../components/auth/PasswordChecklist.jsx");
const AccountTab = (await import("../../components/settings/AccountTab.jsx")).default;

const emailSession = {
  access_token: "tok",
  user: {
    email: "user@example.com",
    user_metadata: { first_name: "Jane", last_name: "Doe" },
    app_metadata: { providers: ["email"] },
  },
};

const googleSession = {
  access_token: "tok",
  user: {
    email: "user@gmail.com",
    user_metadata: { full_name: "Jane Doe" },
    app_metadata: { providers: ["google"] },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  passwordMeetsRequirements.mockReturnValue(true);
});

describe("AccountTab — rendering", () => {
  it("renders the Account heading", () => {
    useAuth.mockReturnValue({ session: emailSession });
    render(<AccountTab />);
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("shows email in read-only field", () => {
    useAuth.mockReturnValue({ session: emailSession });
    render(<AccountTab />);
    expect(screen.getByDisplayValue("user@example.com")).toBeInTheDocument();
  });

  it("shows Change Password section for email/password users", () => {
    useAuth.mockReturnValue({ session: emailSession });
    render(<AccountTab />);
    expect(screen.getByText("Change Password")).toBeInTheDocument();
  });

  it("hides Change Password and shows Google badge for Google users", () => {
    useAuth.mockReturnValue({ session: googleSession });
    render(<AccountTab />);
    expect(screen.queryByText("Change Password")).not.toBeInTheDocument();
    expect(screen.getByText("Signed in with Google")).toBeInTheDocument();
  });
});

describe("AccountTab — Save Changes", () => {
  it("calls updateUser and updateProfile on Save Changes click", async () => {
    useAuth.mockReturnValue({ session: emailSession });
    mockUpdateUser.mockResolvedValue({ error: null });
    updateProfile.mockResolvedValue({});
    render(<AccountTab />);

    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled());
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Jane", lastName: "Doe" }),
      expect.objectContaining({ token: "tok" })
    );
  });

  it("shows success message after save", async () => {
    useAuth.mockReturnValue({ session: emailSession });
    mockUpdateUser.mockResolvedValue({ error: null });
    updateProfile.mockResolvedValue({});
    render(<AccountTab />);

    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => expect(screen.getByText("Profile updated.")).toBeInTheDocument());
  });
});

describe("AccountTab — Change Password validation", () => {
  it("shows error when current password is empty", async () => {
    useAuth.mockReturnValue({ session: emailSession });
    render(<AccountTab />);

    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() =>
      expect(screen.getByText("Please enter your current password.")).toBeInTheDocument()
    );
  });

  it("shows error when new password requirements not met", async () => {
    passwordMeetsRequirements.mockReturnValue(false);
    useAuth.mockReturnValue({ session: emailSession });
    render(<AccountTab />);

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "current123" } });
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() =>
      expect(screen.getByText("New password does not meet requirements.")).toBeInTheDocument()
    );
  });

  it("shows error when passwords do not match", async () => {
    passwordMeetsRequirements.mockReturnValue(true);
    useAuth.mockReturnValue({ session: emailSession });
    render(<AccountTab />);

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "current123" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "NewPassword1!" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "Different1!" } });
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() =>
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument()
    );
  });

  it("shows error when current password is wrong", async () => {
    useAuth.mockReturnValue({ session: emailSession });
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Wrong password" } });
    render(<AccountTab />);

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "wrongpass" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "NewPassword1!" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "NewPassword1!" } });
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() =>
      expect(screen.getByText("Current password is incorrect.")).toBeInTheDocument()
    );
  });
});

describe("AccountTab — Delete Account flow", () => {
  it("shows delete confirmation form when Delete Account is clicked", () => {
    useAuth.mockReturnValue({ session: emailSession });
    render(<AccountTab />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));

    expect(screen.getByPlaceholderText("DELETE")).toBeInTheDocument();
  });

  it("cancels delete and hides form when Cancel is clicked", () => {
    useAuth.mockReturnValue({ session: emailSession });
    render(<AccountTab />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByPlaceholderText("DELETE")).not.toBeInTheDocument();
  });

  it("calls deleteAccount and signOut on confirmed delete", async () => {
    useAuth.mockReturnValue({ session: emailSession });
    deleteAccount.mockResolvedValue({});
    mockSignOut.mockResolvedValue({});
    render(<AccountTab />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith(
      expect.objectContaining({ token: "tok" })
    ));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("shows error message when delete fails", async () => {
    useAuth.mockReturnValue({ session: emailSession });
    deleteAccount.mockRejectedValue(new Error("Server error"));
    render(<AccountTab />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() =>
      expect(screen.getByText("Failed to delete account. Please try again.")).toBeInTheDocument()
    );
  });
});
