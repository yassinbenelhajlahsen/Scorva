import express from "express";
import OpenAI from "openai";
import pool from "../db/db.js";

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * GET /api/games/:id/ai-summary
 *
 * Returns an AI-generated summary for a specific game.
 *
 * COST CONTROL DESIGN:
 * - Summaries are generated ONCE per game (lazy generation)
 * - Stored permanently in games.ai_summary column
 * - All subsequent requests return cached summary
 * - No batch generation, no pre-generation
 * - Only generates when user opens game page
 *
 * FLOW:
 * 1. Check if games.ai_summary exists → return immediately if cached
 * 2. If NULL → fetch game + stats data
 * 3. Build structured box score object
 * 4. Call OpenAI (gpt-4o-mini for cost efficiency)
 * 5. Store result in DB
 * 6. Return summary
 *
 * SAFEGUARDS:
 * - Timeout handling (30s max)
 * - Graceful failure (returns fallback message)
 * - API key validation
 */
router.get("/games/:id/ai-summary", async (req, res) => {
  const { id } = req.params;

  try {
    // Step 1: Check if summary already exists (CACHE CHECK)
    const cachedResult = await pool.query(
      "SELECT ai_summary FROM games WHERE id = $1",
      [id]
    );

    if (cachedResult.rows.length === 0) {
      return res.status(404).json({ error: "Game not found" });
    }

    // If summary exists, return it immediately (NO OpenAI call)
    if (cachedResult.rows[0].ai_summary) {
      return res.json({
        summary: cachedResult.rows[0].ai_summary,
        cached: true,
      });
    }

    // Step 2: Summary doesn't exist - fetch full game data
    const gameResult = await pool.query(
      `SELECT 
        g.id,
        g.league,
        g.date,
        g.homescore,
        g.awayscore,
        g.venue,
        g.status,
        g.firstqtr,
        g.secondqtr,
        g.thirdqtr,
        g.fourthqtr,
        g.ot1,
        g.ot2,
        g.ot3,
        g.ot4,
        ht.name as home_team_name,
        ht.shortname as home_team_short,
        at.name as away_team_name,
        at.shortname as away_team_short
      FROM games g
      JOIN teams ht ON ht.id = g.hometeamid
      JOIN teams at ON at.id = g.awayteamid
      WHERE g.id = $1`,
      [id]
    );

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: "Game not found" });
    }

    const game = gameResult.rows[0];

    // Only generate summaries for completed games
    if (!game.status || !game.status.toLowerCase().includes("final")) {
      return res.json({
        summary: "AI summary unavailable for this game.",
        reason: "Game must be completed before summary can be generated",
        cached: false,
      });
    }

    // Step 3: Fetch player stats
    const statsResult = await pool.query(
      `SELECT 
        s.*,
        p.name as player_name,
        p.position,
        p.teamid,
        t.shortname as team_short
      FROM stats s
      JOIN players p ON p.id = s.playerid
      JOIN teams t ON t.id = p.teamid
      WHERE s.gameid = $1
      ORDER BY s.points DESC NULLS LAST, s.assists DESC NULLS LAST`,
      [id]
    );

    // Step 4: Build structured game data for OpenAI
    const gameData = buildGameData(game, statsResult.rows);

    // Step 5: Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return res.json({
        summary: "AI summary unavailable for this game.",
        reason: "OpenAI API key not configured",
        cached: false,
      });
    }

    // Step 6: Generate AI summary (ONLY HAPPENS ONCE)
    const summary = await generateAISummary(gameData, game.league);

    // Step 7: Store summary permanently in database
    await pool.query("UPDATE games SET ai_summary = $1 WHERE id = $2", [
      summary,
      id,
    ]);

    // Step 8: Return generated summary
    return res.json({
      summary,
      cached: false,
    });
  } catch (error) {
    console.error("Error generating AI summary:", error);

    // Graceful failure - return fallback message
    return res.json({
      summary: "AI summary unavailable for this game.",
      error: error.message,
      cached: false,
    });
  }
});

/**
 * Build structured game data object for OpenAI prompt
 */
function buildGameData(game, stats) {
  const league = game.league.toUpperCase();

  // Build quarter-by-quarter scores
  const quarters = [];
  if (game.firstqtr) quarters.push({ period: "Q1", score: game.firstqtr });
  if (game.secondqtr) quarters.push({ period: "Q2", score: game.secondqtr });
  if (game.thirdqtr) quarters.push({ period: "Q3", score: game.thirdqtr });
  if (game.fourthqtr) quarters.push({ period: "Q4", score: game.fourthqtr });
  if (game.ot1) quarters.push({ period: "OT1", score: game.ot1 });
  if (game.ot2) quarters.push({ period: "OT2", score: game.ot2 });
  if (game.ot3) quarters.push({ period: "OT3", score: game.ot3 });
  if (game.ot4) quarters.push({ period: "OT4", score: game.ot4 });

  // Get top performers by league
  const topPerformers = getTopPerformers(stats, league);

  // Calculate team stats
  const homeStats = calculateTeamStats(
    stats.filter((s) => s.team_short === game.home_team_short),
    league
  );
  const awayStats = calculateTeamStats(
    stats.filter((s) => s.team_short === game.away_team_short),
    league
  );

  return {
    league,
    date: game.date,
    homeTeam: game.home_team_name,
    awayTeam: game.away_team_name,
    homeScore: game.homescore,
    awayScore: game.awayscore,
    winner:
      game.homescore > game.awayscore
        ? game.home_team_name
        : game.away_team_name,
    quarterByQuarter: quarters,
    topPerformers,
    teamStats: {
      home: homeStats,
      away: awayStats,
    },
  };
}

/**
 * Extract top performers based on league
 */
function getTopPerformers(stats, league) {
  const performers = [];

  if (league === "NBA") {
    // Top 3 scorers
    const topScorers = stats
      .filter((s) => s.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);

    performers.push(
      ...topScorers.map((s) => ({
        name: s.player_name,
        team: s.team_short,
        stats: `${s.points} PTS, ${s.rebounds || 0} REB, ${s.assists || 0} AST`,
      }))
    );
  } else if (league === "NFL") {
    // Top passers and rushers
    const topPerformers = stats
      .filter((s) => s.yds > 0 || s.td > 0)
      .sort(
        (a, b) =>
          (b.yds || 0) + (b.td || 0) * 20 - (a.yds || 0) - (a.td || 0) * 20
      )
      .slice(0, 3);

    performers.push(
      ...topPerformers.map((s) => ({
        name: s.player_name,
        team: s.team_short,
        stats: `${s.yds || 0} YDS, ${s.td || 0} TD`,
      }))
    );
  } else if (league === "NHL") {
    // Top point getters
    const topScorers = stats
      .filter((s) => (s.g || 0) > 0 || (s.a || 0) > 0)
      .sort((a, b) => (b.g || 0) + (b.a || 0) - (a.g || 0) - (a.a || 0))
      .slice(0, 3);

    performers.push(
      ...topScorers.map((s) => ({
        name: s.player_name,
        team: s.team_short,
        stats: `${s.g || 0} G, ${s.a || 0} A`,
      }))
    );
  }

  return performers;
}

/**
 * Calculate aggregate team statistics
 */
function calculateTeamStats(teamStats, league) {
  if (teamStats.length === 0) return {};

  if (league === "NBA") {
    const totalPoints = teamStats.reduce((sum, s) => sum + (s.points || 0), 0);
    const totalRebounds = teamStats.reduce(
      (sum, s) => sum + (s.rebounds || 0),
      0
    );
    const totalAssists = teamStats.reduce(
      (sum, s) => sum + (s.assists || 0),
      0
    );
    const fgMade = teamStats.reduce((sum, s) => {
      const fg = s.fg ? s.fg.split("-")[0] : "0";
      return sum + parseInt(fg);
    }, 0);
    const fgAttempted = teamStats.reduce((sum, s) => {
      const fg = s.fg ? s.fg.split("-")[1] : "0";
      return sum + parseInt(fg);
    }, 0);

    return {
      points: totalPoints,
      rebounds: totalRebounds,
      assists: totalAssists,
      fgPct:
        fgAttempted > 0
          ? ((fgMade / fgAttempted) * 100).toFixed(1) + "%"
          : "0%",
    };
  } else if (league === "NFL") {
    const totalYds = teamStats.reduce((sum, s) => sum + (s.yds || 0), 0);
    const totalTd = teamStats.reduce((sum, s) => sum + (s.td || 0), 0);

    return {
      totalYards: totalYds,
      touchdowns: totalTd,
    };
  } else if (league === "NHL") {
    const totalGoals = teamStats.reduce((sum, s) => sum + (s.g || 0), 0);
    const totalAssists = teamStats.reduce((sum, s) => sum + (s.a || 0), 0);
    const totalShots = teamStats.reduce((sum, s) => sum + (s.shots || 0), 0);

    return {
      goals: totalGoals,
      assists: totalAssists,
      shots: totalShots,
    };
  }

  return {};
}

/**
 * Generate AI summary using OpenAI
 * Uses gpt-4o-mini for cost efficiency
 * Timeout: 30 seconds
 */
async function generateAISummary(gameData, league) {
  const prompt = buildPrompt(gameData, league);

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini", // Cost-efficient model
        messages: [
          {
            role: "system",
            content:
              "You are a sports analyst who writes concise, factual game summaries for knowledgeable fans. Format your response as 3 bullet points. Each bullet point should be one clear insight. Focus on: why the winner won, standout player performances, and key statistical advantages. Be factual and concise. No hype.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 250,
      }),
      // 30 second timeout
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OpenAI request timeout")), 30000)
      ),
    ]);

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

/**
 * Build OpenAI prompt with structured game data
 */
function buildPrompt(gameData, league) {
  return `Summarize this ${league} game for a knowledgeable fan using 3-4 bullet points.

Format each bullet point with a dash (-) or bullet (•) at the start.

Include:
- Why the winning team won (key moment or advantage)
- Top 1-2 standout player performances with stats
- A crucial statistical difference or momentum shift

Be factual and concise. No hype or commentary.

Game data:
${JSON.stringify(gameData, null, 2)}`;
}

export default router;
