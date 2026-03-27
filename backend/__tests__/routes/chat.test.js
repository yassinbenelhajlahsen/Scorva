import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Mocks ---

const mockStreamChat = jest.fn((req, res) => {
  res.status(200).json({ ok: true });
});
jest.unstable_mockModule(
  resolve(__dirname, "../../src/controllers/chatController.js"),
  () => ({ streamChat: mockStreamChat })
);

const mockRequireAuth = jest.fn((req, res, next) => next());
jest.unstable_mockModule(resolve(__dirname, "../../src/middleware/auth.js"), () => ({
  requireAuth: mockRequireAuth,
}));

const mockChatLimiter = jest.fn((req, res, next) => next());
jest.unstable_mockModule(resolve(__dirname, "../../src/middleware/index.js"), () => ({
  chatLimiter: mockChatLimiter,
  generalLimiter: jest.fn((req, res, next) => next()),
  sseConnectionLimiter: jest.fn((req, res, next) => next()),
  aiLimiter: jest.fn((req, res, next) => next()),
  requestLogger: jest.fn((req, res, next) => next()),
}));

const { default: express } = await import("express");
const { default: request } = await import("supertest");
const routerPath = resolve(__dirname, "../../src/routes/chat.js");
const { default: chatRouter } = await import(routerPath);

describe("Chat Route — POST /api/chat", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", chatRouter);
    jest.clearAllMocks();
    mockStreamChat.mockImplementation((req, res) => res.status(200).json({ ok: true }));
    mockRequireAuth.mockImplementation((req, res, next) => next());
    mockChatLimiter.mockImplementation((req, res, next) => next());
  });

  it("POST /api/chat calls chatLimiter, then requireAuth, then streamChat", async () => {
    const callOrder = [];
    mockChatLimiter.mockImplementation((req, res, next) => {
      callOrder.push("chatLimiter");
      next();
    });
    mockRequireAuth.mockImplementation((req, res, next) => {
      callOrder.push("requireAuth");
      next();
    });
    mockStreamChat.mockImplementation((req, res) => {
      callOrder.push("streamChat");
      res.status(200).json({ ok: true });
    });

    await request(app).post("/api/chat").send({ message: "hello" });

    expect(callOrder).toEqual(["chatLimiter", "requireAuth", "streamChat"]);
  });

  it("returns 401 when requireAuth rejects", async () => {
    mockRequireAuth.mockImplementation((req, res) => {
      res.status(401).json({ error: "Unauthorized" });
    });

    const response = await request(app).post("/api/chat").send({ message: "hello" });

    expect(response.status).toBe(401);
    expect(mockStreamChat).not.toHaveBeenCalled();
  });

  it("returns 429 when chatLimiter rejects", async () => {
    mockChatLimiter.mockImplementation((req, res) => {
      res.status(429).json({ error: "Too many requests" });
    });

    const response = await request(app).post("/api/chat").send({ message: "hello" });

    expect(response.status).toBe(429);
    expect(mockStreamChat).not.toHaveBeenCalled();
  });

  it("delegates to streamChat on successful middleware chain", async () => {
    const response = await request(app).post("/api/chat").send({ message: "hello" });

    expect(response.status).toBe(200);
    expect(mockStreamChat).toHaveBeenCalledTimes(1);
  });
});
