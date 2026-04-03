import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordChecklist, passwordMeetsRequirements } from "../../components/auth/PasswordChecklist.jsx";

describe("passwordMeetsRequirements", () => {
  it("returns true for a valid password", () => {
    expect(passwordMeetsRequirements("Secure1!")).toBe(true);
  });

  it("returns false when too short", () => {
    expect(passwordMeetsRequirements("Ab1")).toBe(false);
  });

  it("returns false when missing uppercase", () => {
    expect(passwordMeetsRequirements("secure123")).toBe(false);
  });

  it("returns false when missing lowercase", () => {
    expect(passwordMeetsRequirements("SECURE123")).toBe(false);
  });

  it("returns false when missing number", () => {
    expect(passwordMeetsRequirements("SecurePass")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(passwordMeetsRequirements("")).toBe(false);
  });
});

describe("PasswordChecklist component", () => {
  it("renders nothing when password is empty/null", () => {
    const { container } = render(<PasswordChecklist password="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 4 checklist items", () => {
    render(<PasswordChecklist password="abc" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
  });

  it("shows all 4 criteria labels", () => {
    render(<PasswordChecklist password="abc" />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("One uppercase letter")).toBeInTheDocument();
    expect(screen.getByText("One lowercase letter")).toBeInTheDocument();
    expect(screen.getByText("One number")).toBeInTheDocument();
  });
});
