import express from "express";
import cors from "cors";
import helmet from "helmet";
import "./config/env.js";
import { closeCache } from "./cache/cache.js";
import pool from "./db/db.js";
import { shutdown as shutdownNotificationBus } from "./db/notificationBus.js";
import logger from "./logger.js";
import {
  requestLogger,
  generalLimiter,
  sseConnectionLimiter,
  chatSseConnectionLimiter,
  corsOrigins,
} from "./middleware/index.js";
import teamsRouter from "./routes/teams.js";
import standingsRouter from "./routes/standings.js";
import gamesInfoRoute from "./routes/gameDetail.js";
import playersRoute from "./routes/players.js";
import playerInfoRoute from "./routes/playerDetail.js";
import similarPlayersRoute from "./routes/similarPlayers.js";
import gamesRoute from "./routes/games.js";
import searchRoute from "./routes/search.js";
import aiSummaryRoute from "./routes/aiSummary.js";
import chatRoute from "./routes/chat.js";
import seasonsRoute from "./routes/seasons.js";
import favoritesRoute from "./routes/favorites.js";
import userRoute from "./routes/user.js";
import webhooksRoute from "./routes/webhooks.js";
import liveRoute from "./routes/live.js";
import predictionRoute from "./routes/prediction.js";

const app = express();

// Trust proxy for accurate IP detection behind reverse proxies (Railway, Vercel, etc.)
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// Request logging
app.use(requestLogger);

// CORS configuration
app.use(cors({ origin: corsOrigins }));

// JSON body parser (10kb limit — all payloads in this app are small)
app.use(express.json({ limit: "10kb" }));

// Supabase auth webhook — no rate limiter, verified by secret header
app.use("/api", webhooksRoute);

// AI summary endpoint (stricter rate limiter applied inside the route)
app.use("/api", aiSummaryRoute);

// Chat agent endpoint (auth-gated, chatLimiter applied inside the route)
app.use("/api/chat", chatSseConnectionLimiter);
app.use("/api", chatRoute);

// SSE live endpoints — mounted before rate limiter (long-lived connections)
app.use("/api/live", sseConnectionLimiter);
app.use("/api", liveRoute);

// Apply general rate limiter to all other /api routes
app.use("/api", generalLimiter);
app.use("/api", teamsRouter);
app.use("/api", standingsRouter);
app.use("/api", gamesRoute);
app.use("/api", gamesInfoRoute);
app.use("/api", predictionRoute);
app.use("/api", playersRoute);
app.use("/api", playerInfoRoute);
app.use("/api", similarPlayersRoute);
app.use("/api", searchRoute);
app.use("/api", seasonsRoute);
app.use("/api", favoritesRoute);
app.use("/api", userRoute);

const port = process.env.PORT || 8080;
const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "server ready");
});

process.on("SIGTERM", async () => {
  logger.info("shutting down");
  server.close();
  await shutdownNotificationBus();
  await closeCache();
  await pool.end();
  process.exit(0);
});
