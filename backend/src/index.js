import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import "./config/env.js";
import teamsRouter from "./routes/teams.js";
import standingsRouter from "./routes/standings.js";
import gamesInfoRoute from "./routes/gameInfo.js";
import playersRoute from "./routes/players.js";
import playerInfoRoute from "./routes/playerInfo.js";
import gamesRoute from "./routes/games.js";
import searchRoute from "./routes/search.js";
import aiSummaryRoute from "./routes/aiSummary.js";

const app = express();

// Trust proxy for accurate IP detection behind reverse proxies (Railway, Vercel, etc.)
app.set("trust proxy", 1);

// General rate limiter for all API endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2500, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: "15 minutes",
  },
});

// Stricter rate limiter for AI summary endpoint (more expensive operation)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 20 AI requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many AI summary requests, please try again later.",
    retryAfter: "15 minutes",
  },
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://scorva.vercel.app",
      "http://192.168.1.68:5173",
      "http://192.168.1.68:5174",
      "http://192.168.1.68:5175",
    ],
  }),
);

app.use(express.json());

// Apply stricter rate limiter to AI summary endpoint (more expensive operation)
app.use("/api", aiLimiter, aiSummaryRoute);

// Apply general rate limiter to all other /api routes
app.use("/api", generalLimiter);
app.use("/api", teamsRouter);
app.use("/api", standingsRouter);
app.use("/api", gamesRoute);
app.use("/api", gamesInfoRoute);
app.use("/api", playersRoute);
app.use("/api", playerInfoRoute);
app.use("/api", searchRoute);

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("✅ Server running on port: ", process.env.PORT || 3000);
});
