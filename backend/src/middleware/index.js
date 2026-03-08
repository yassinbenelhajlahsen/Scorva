import rateLimit from "express-rate-limit";

export const log = (level, message, meta = {}) => {
  const entry = { time: new Date().toISOString(), level, message, ...meta };
  const out = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(out + "\n");
  } else {
    process.stdout.write(out + "\n");
  }
};


export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  let logged = false;
  const originalEnd = res.end;

  res.end = function (...args) {
    if (!logged) {
      logged = true;
      const duration = Date.now() - startTime;
      const status = res.statusCode;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      log(level, "request", {
        method: req.method,
        url: req.originalUrl,
        status,
        duration_ms: duration,
      });
    }
    originalEnd.apply(res, args);
  };

  next();
};

const isProd = process.env.NODE_ENV === "production";
log("info", "server starting", { env: process.env.NODE_ENV || "development" });
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

// Per-IP concurrent SSE connection limiter (prevents pg pool exhaustion)
const SSE_MAX_PER_IP = 6;
const sseConnections = new Map();

export function sseConnectionLimiter(req, res, next) {
  const ip = req.ip;
  const count = sseConnections.get(ip) || 0;
  if (count >= SSE_MAX_PER_IP) {
    return res.status(429).json({ error: "Too many live connections" });
  }
  sseConnections.set(ip, count + 1);
  res.on("close", () => {
    const cur = sseConnections.get(ip) || 1;
    if (cur <= 1) sseConnections.delete(ip);
    else sseConnections.set(ip, cur - 1);
  });
  next();
}

export const corsOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://scorva.vercel.app",
  "https://scorva.dev",
  "http://192.168.1.68:5173",
  "http://192.168.1.68:5174",
  "http://192.168.1.68:5175",
];
