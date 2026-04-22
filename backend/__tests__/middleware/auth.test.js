import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockGetUser = jest.fn();
const mockEnsureUserFromSupabase = jest.fn();

jest.unstable_mockModule("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/user/ensureUser.js"),
  () => ({
    ensureUserFromSupabase: mockEnsureUserFromSupabase,
  })
);

const { requireAuth } = await import(resolve(__dirname, "../../src/middleware/auth.js"));

function makeResMock() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("requireAuth middleware", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockReset(); // clear unconsumed mockResolvedValueOnce queue between tests
    mockEnsureUserFromSupabase.mockReset();
    mockEnsureUserFromSupabase.mockResolvedValue(undefined);
    req = { headers: {} };
    res = makeResMock();
    next = jest.fn();
  });

  it("returns 401 when no Authorization header is present", async () => {
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is empty string after stripping Bearer", async () => {
    // Token becomes "" (falsy) — getUser is never called
    req.headers.authorization = "Bearer ";

    await requireAuth(req, res, next);

    // Empty token — getUser may be called with empty string; if it returns no user: 401
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and sets req.user when token is valid", async () => {
    const fakeUser = { id: "user-123", email: "test@example.com" };
    req.headers.authorization = "Bearer valid-token";
    mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser }, error: null });

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith("valid-token");
    expect(req.user).toEqual(fakeUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("strips the Bearer prefix before passing token to getUser", async () => {
    req.headers.authorization = "Bearer my-secret-token";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith("my-secret-token");
  });

  it("returns 401 when getUser returns an error", async () => {
    req.headers.authorization = "Bearer bad-token";
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("Token expired"),
    });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when getUser returns no user (null)", async () => {
    req.headers.authorization = "Bearer revoked-token";
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("does not call next on auth failure", async () => {
    req.headers.authorization = "Bearer bad";
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("fail") });

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("propagates exception when getUser throws (no try/catch in middleware)", async () => {
    req.headers.authorization = "Bearer throws-token";
    mockGetUser.mockRejectedValueOnce(new Error("Network error"));

    await expect(requireAuth(req, res, next)).rejects.toThrow("Network error");
    expect(next).not.toHaveBeenCalled();
  });
});
