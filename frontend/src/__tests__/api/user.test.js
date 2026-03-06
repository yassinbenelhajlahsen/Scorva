import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../../api/client.js");
const { getProfile, updateProfile, deleteAccount } = await import("../../api/user.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({});
});

describe("getProfile", () => {
  it("GETs /api/user/profile with token", async () => {
    await getProfile({ token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/user/profile",
      expect.objectContaining({ token: "tok" })
    );
  });
});

describe("updateProfile", () => {
  it("PATCHes /api/user/profile with fields and token", async () => {
    await updateProfile({ firstName: "Yassin" }, { token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/user/profile",
      expect.objectContaining({ method: "PATCH", token: "tok", body: { firstName: "Yassin" } })
    );
  });
});

describe("deleteAccount", () => {
  it("DELETEs /api/user/account with token", async () => {
    await deleteAccount({ token: "tok" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/user/account",
      expect.objectContaining({ method: "DELETE", token: "tok" })
    );
  });
});
