import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import logger from "../logger.js";

export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  serializers: {
    req: () => undefined,
    res: () => undefined,
  },
});

const isProd = process.env.NODE_ENV === "production";
// General rate limiter for all API endpoints
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 3000 : 1000000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: "15 minutes",
  },
});

// Stricter rate limiter for AI summary endpoint
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 50: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many AI summary requests, please try again later.",
    retryAfter: "15 minutes",
  },
});

// Chat agent rate limiter — stricter than AI summary (each turn may make multiple LLM calls)
export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many chat messages, please try again later.",
    retryAfter: "15 minutes",
  },
});

// Per-IP concurrent SSE connection limiter (prevents pg pool exhaustion)
const SSE_MAX_PER_IP = 6;
const SSE_MAX_GLOBAL = 100;
const sseConnections = new Map();
let sseGlobalCount = 0;

export function sseConnectionLimiter(req, res, next) {
  const ip = req.ip;
  const count = sseConnections.get(ip) || 0;
  if (count >= SSE_MAX_PER_IP) {
    return res.status(429).json({ error: "Too many live connections" });
  }
  if (sseGlobalCount >= SSE_MAX_GLOBAL) {
    return res.status(503).json({ error: "Server at capacity, try again later" });
  }
  sseConnections.set(ip, count + 1);
  sseGlobalCount++;
  res.on("close", () => {
    const cur = sseConnections.get(ip) || 1;
    if (cur <= 1) sseConnections.delete(ip);
    else sseConnections.set(ip, cur - 1);
    sseGlobalCount = Math.max(0, sseGlobalCount - 1);
  });
  next();
}

export const corsOrigins = [
  "https://scorva.vercel.app",
  "https://scorva.dev",
  ...(isProd
    ? []
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://192.168.1.68:5173",
        "http://192.168.1.68:5174",
        "http://192.168.1.68:5175",
      ]),
];
