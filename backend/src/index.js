import express from "express";
import cors from "cors";
import "./config/env.js";
import {
  requestLogger,
  generalLimiter,
  aiLimiter,
  corsOrigins,
  log,
} from "./middleware/index.js";
import teamsRouter from "./routes/teams.js";
import standingsRouter from "./routes/standings.js";
import gamesInfoRoute from "./routes/gameInfo.js";
import playersRoute from "./routes/players.js";
import playerInfoRoute from "./routes/playerInfo.js";
import gamesRoute from "./routes/games.js";
import searchRoute from "./routes/search.js";
import aiSummaryRoute from "./routes/aiSummary.js";
import seasonsRoute from "./routes/seasons.js";
import favoritesRoute from "./routes/favorites.js";
import webhooksRoute from "./routes/webhooks.js";

const app = express();

// Trust proxy for accurate IP detection behind reverse proxies (Railway, Vercel, etc.)
app.set("trust proxy", 1);

// Request logging
app.use(requestLogger);

// CORS configuration
app.use(cors({ origin: corsOrigins }));

// JSON body parser
app.use(express.json());

// Supabase auth webhook — no rate limiter, verified by secret header
app.use("/api", webhooksRoute);

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
app.use("/api", seasonsRoute);
app.use("/api", favoritesRoute);

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  log("info", "server ready", { port });
});
