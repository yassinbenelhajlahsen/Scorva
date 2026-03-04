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

  // Build quarter-by-quarter scores split by home/away
  const parseScore = (scoreStr) => {
    if (!scoreStr) return null;
    const parts = scoreStr.split("-");
    return { home: parseInt(parts[0]) || 0, away: parseInt(parts[1]) || 0 };
  };

  const hadOT = !!(game.ot1 || game.ot2 || game.ot3 || game.ot4);
  const quarterPeriods = [
    { key: "firstqtr", label: "Q1" },
    { key: "secondqtr", label: "Q2" },
    { key: "thirdqtr", label: "Q3" },
    { key: "fourthqtr", label: "Q4" },
    { key: "ot1", label: "OT1" },
    { key: "ot2", label: "OT2" },
    { key: "ot3", label: "OT3" },
    { key: "ot4", label: "OT4" },
  ];

  const quarterByQuarter = { home: [], away: [], periods: [] };
  for (const { key, label } of quarterPeriods) {
    const parsed = parseScore(game[key]);
    if (parsed) {
      quarterByQuarter.home.push(parsed.home);
      quarterByQuarter.away.push(parsed.away);
      quarterByQuarter.periods.push(label);
    }
  }

  const margin = Math.abs(game.homescore - game.awayscore);
  let storyType;
  if (hadOT) {
    storyType = "overtime";
  } else if (margin <= 5) {
    storyType = "nail-biter";
  } else if (margin >= 25) {
    storyType = "blowout";
  } else {
    storyType = "standard";
  }

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
    margin,
    storyType,
    hadOT,
    quarterByQuarter,
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
              "You are a sports analyst who writes concise, factual game summaries for knowledgeable fans. Format your response as 3 bullet points. Each bullet point should be one clear insight. Be factual and concise. No hype. Vary your sentence structure and opening words. Never start two bullets the same way.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.9,
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
  const storyFrames = {
    "nail-biter": `This was a nail-biter decided by ${gameData.margin} point(s). Focus on what separated the teams in the final moments.`,
    overtime: `This game went to overtime. Focus on what forced OT and how ${gameData.winner} ultimately pulled ahead.`,
    blowout: `This was a blowout — ${gameData.winner} won by ${gameData.margin}. Focus on when and why the game got away from the loser.`,
    standard: `${gameData.winner} won by ${gameData.margin}. Focus on the key advantages that drove the result.`,
  };

  const frame = storyFrames[gameData.storyType] || storyFrames.standard;

  return `Summarize this ${league} game for a knowledgeable fan using exactly 3 bullet points.

Narrative frame: ${frame}

Rules:
- Start each bullet with a dash (-)
- Do NOT restate the final score as a bullet — the reader already knows it
- Anchor each bullet to something specific from the game data: a player performance, a quarter swing, or a statistical gap
- Focus on what made THIS game different using the storyType and topPerformers as your primary anchors

Game data:
${JSON.stringify(gameData, null, 2)}`;
}

export default router;
