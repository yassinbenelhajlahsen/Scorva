import rateLimit from "express-rate-limit";

export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Flag to prevent multiple logs for the same request
  let logged = false;

  // Capture the original end function
  const originalEnd = res.end;

  res.end = function (...args) {
    // Only log once per request
    if (!logged) {
      logged = true;
      
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Color code based on status
      let statusIcon;
      if (statusCode >= 500) {
        statusIcon = "🔴"; // Server error
      } else if (statusCode >= 400) {
        statusIcon = "🟡"; // Client error
      } else if (statusCode >= 300) {
        statusIcon = "🔵"; // Redirect
      } else {
        statusIcon = "🟢"; // Success
      }

      // Build log message
      const method = req.method.padEnd(6);
      const url = req.originalUrl;
      const query =
        Object.keys(req.query).length > 0 ? ` ${JSON.stringify(req.query)}` : "";

      console.log(
        `${statusIcon} ${statusCode} | ${method} ${url}${query} | ${duration}ms`,
      );
    }

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
};

// General rate limiter for all API endpoints
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Limit each IP to 3,000 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: "15 minutes",
  },
});

// Stricter rate limiter for AI summary endpoint (more expensive operation)
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 AI requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many AI summary requests, please try again later.",
    retryAfter: "15 minutes",
  },
});

export const corsOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://scorva.vercel.app",
  "http://192.168.1.68:5173",
  "http://192.168.1.68:5174",
  "http://192.168.1.68:5175",
];
