import express from 'express';
import dotenv from 'dotenv';
import teamsRouter from './routes/teams.js';
import standingsRouter from './routes/standings.js';
import gamesInfoRoute from "./routes/gameInfo.js";
import playersRoute from "./routes/players.js";
import playerInfoRoute from "./routes/playerInfo.js";
import gamesRoute from "./routes/games.js";
import searchRoute from "./routes/search.js";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors({
  origin: ["http://localhost:5173", "https://scorva.vercel.app"],
}));

app.use(express.json());
app.use('/api', teamsRouter);
app.use('/api', standingsRouter);
app.use('/api', gamesRoute);
app.use('/api', gamesInfoRoute);
app.use('/api', playersRoute);
app.use('/api', playerInfoRoute);
app.use('/api', searchRoute);

app.listen(process.env.PORT || 3000 , () => {
  console.log('✅ Server running on port: ', process.env.PORT);
});
