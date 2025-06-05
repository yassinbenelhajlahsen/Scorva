import express from 'express';
import dotenv from 'dotenv';
import teamsRouter from './routes/teams.js';
import standingsRouter from './routes/standings.js';
import teamsGames from './routes/teamGames.js';

dotenv.config();
const app = express();

app.use(express.json());
app.use('/api', teamsRouter);
app.use('/api', standingsRouter);
app.use('/api', teamsGames)
app.listen(process.env.PORT || 3000, () => {
  console.log('✅ Server running on port 3000');
});