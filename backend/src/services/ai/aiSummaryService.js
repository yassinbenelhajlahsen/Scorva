import OpenAI from "openai";
import pool from "../../db/db.js";
import logger from "../../logger.js";
import { embedGameSummary } from "./embeddingService.js";
import { getPlays } from "../games/playsService.js";

function parseClockToSeconds(clock) {
  if (!clock) return null;
  // Sub-minute format: "5.4" or "0.4" (seconds only, no colon)
  if (!clock.includes(":")) {
    const secs = parseFloat(clock);
    return Number.isNaN(secs) ? null : secs;
  }
  const parts = clock.split(":");
  if (parts.length !== 2) return null;
  const mins = parseInt(parts[0], 10);
  const secs = parseFloat(parts[1]);
  if (Number.isNaN(mins) || Number.isNaN(secs)) return null;
  return mins * 60 + secs;
}

// NHL stores elapsed time per period; convert to time remaining
function nhlClockToRemaining(clock, period) {
  const elapsed = parseClockToSeconds(clock);
  if (elapsed === null) return null;
  // Playoff OT is 20 min; regular-season OT is 5 min — heuristic: elapsed > 300 means 20-min period
  const periodLen = period > 3 && elapsed <= 300 ? 300 : 1200;
  return Math.max(0, periodLen - elapsed);
}

function periodLabel(period, league) {
  const isHockey = league === "NHL";
  const finalReg = isHockey ? 3 : 4;
  if (period <= finalReg) {
    return isHockey ? `P${period}` : `Q${period}`;
  }
  const otNum = period - finalReg;
  return otNum === 1 ? "OT" : `OT${otNum}`;
}

function mapPlay(play, leagueUpper) {
  return {
    clock: play.clock,
    period: periodLabel(play.period, leagueUpper),
    description: play.description,
    score: play.home_score != null && play.away_score != null
      ? `${play.home_score}-${play.away_score}`
      : null,
    scoringPlay: play.scoring_play,
  };
}

export async function getClutchPlays(gameId, league) {
  try {
    const result = await getPlays(gameId, league);
    if (!result || !result.plays || result.plays.length === 0) {
      return { plays: [], gameWinningPlay: null };
    }

    const leagueUpper = league.toUpperCase();
    const finalRegPeriod = leagueUpper === "NHL" ? 3 : 4;
    const CLUTCH_SECONDS = 300; // 5 minutes

    // Last scoring play from the entire game = the game winner
    const lastScoringPlay = [...result.plays]
      .reverse()
      .find((p) => p.scoring_play);
    const gameWinningPlay = lastScoringPlay ? mapPlay(lastScoringPlay, leagueUpper) : null;

    const clutch = result.plays.filter((play) => {
      if (play.period > finalRegPeriod) return true; // all OT plays
      if (play.period !== finalRegPeriod) return false;

      let remaining;
      if (leagueUpper === "NHL") {
        remaining = nhlClockToRemaining(play.clock, play.period);
      } else {
        remaining = parseClockToSeconds(play.clock);
      }
      return remaining !== null && remaining <= CLUTCH_SECONDS;
    });

    // Sort chronologically, cap at last 20 (most clutch)
    clutch.sort((a, b) => a.sequence - b.sequence);
    const capped = clutch.slice(-20);

    return {
      plays: capped.map((play) => mapPlay(play, leagueUpper)),
      gameWinningPlay,
    };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch clutch plays for AI summary");
    return { plays: [], gameWinningPlay: null };
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getCachedSummary(id) {
  const result = await pool.query(
    "SELECT ai_summary FROM games WHERE id = $1",
    [id]
  );
  if (result.rows.length === 0) return { notFound: true };
  return { summary: result.rows[0].ai_summary };
}

export async function getGameForSummary(id) {
  const result = await pool.query(
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
  return result.rows[0] ?? null;
}

export async function getGameStats(id) {
  const result = await pool.query(
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
  return result.rows;
}

export async function saveSummary(id, summary) {
  await pool.query("UPDATE games SET ai_summary = $1 WHERE id = $2", [
    summary,
    id,
  ]);
  // Fire-and-forget: generate embedding for RAG semantic search
  embedGameSummary(id).catch(() => {});
}

export function buildGameData(game, stats, clutchData = {}) {
  const { plays: clutchPlays = [], gameWinningPlay = null } = clutchData;
  const league = game.league.toUpperCase();

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

  const thresholds = {
    NBA: { nailBiter: 5, blowout: 20 },
    NFL: { nailBiter: 5, blowout: 17 },
    NHL: { nailBiter: 1, blowout: 4 },
  };
  const t = thresholds[league] || thresholds.NBA;

  let storyType;
  if (hadOT) {
    storyType = "overtime";
  } else if (margin <= t.nailBiter) {
    storyType = "nail-biter";
  } else if (margin >= t.blowout) {
    storyType = "blowout";
  } else {
    storyType = "standard";
  }

  // Garbage time — don't include clutch plays for blowouts
  const isBlowout = storyType === "blowout";
  const filteredClutchPlays = isBlowout ? [] : clutchPlays;
  const filteredGameWinner = isBlowout ? null : gameWinningPlay;

  const topPerformers = getTopPerformers(stats, league);

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
    ...(filteredClutchPlays.length > 0 ? { clutchPlays: filteredClutchPlays } : {}),
    ...(filteredGameWinner ? { gameWinningPlay: filteredGameWinner } : {}),
  };
}

export function getTopPerformers(stats, league) {
  const performers = [];

  if (league === "NBA") {
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

export function calculateTeamStats(teamStats, league) {
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

function cleanBullet(raw) {
  return raw
    .trim()
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .trim();
}

export async function streamAISummary(gameData, league, onBullet, { signal } = {}) {
  const prompt = buildPrompt(gameData, league);

  const stream = await Promise.race([
    openai.chat.completions.create({
      model: "gpt-4o-mini",
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
      max_tokens: 300,
      stream: true,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("OpenAI request timeout")), 30000)
    ),
  ]);

  let buffer = "";

  try {
    for await (const chunk of stream) {
      if (signal?.aborted) {
        stream.controller.abort();
        return buffer;
      }

      const token = chunk.choices[0]?.delta?.content ?? "";
      buffer += token;

      // Extract all completed bullets from the buffer (a bullet ends when the next \n- starts)
      let match;
      while ((match = buffer.match(/^([\s\S]+?)\n\s*-\s/))) {
        const completed = match[1];
        const cleaned = cleanBullet(completed);
        if (cleaned) onBullet(cleaned);
        const boundary = buffer.indexOf("\n", match[1].length);
        buffer = buffer.slice(boundary + 1).trimStart();
      }
    }
  } catch (err) {
    if (signal?.aborted) return buffer;
    logger.error({ err }, "OpenAI stream error");
    throw err;
  }

  // Flush remaining buffer as the final bullet
  const cleaned = cleanBullet(buffer);
  if (cleaned) onBullet(cleaned);

  return buffer;
}

export async function generateAISummary(gameData, league) {
  const prompt = buildPrompt(gameData, league);

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
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
        max_tokens: 300,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OpenAI request timeout")), 30000)
      ),
    ]);

    return completion.choices[0].message.content.trim();
  } catch (error) {
    logger.error({ err: error }, "OpenAI API error");
    throw error;
  }
}

export function buildPrompt(gameData, league) {
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
- Anchor each bullet to something specific from the game data: a player performance, a quarter swing, a statistical gap, or a late-game play
- Focus on what made THIS game different using the storyType and topPerformers as your primary anchors${gameData.gameWinningPlay ? "\n- One bullet MUST describe the gameWinningPlay by player name — this is the decisive final play" : gameData.clutchPlays ? "\n- One bullet MUST reference a specific late-game moment from the clutchPlays data" : ""}

Game data:
${JSON.stringify(gameData, null, 2)}`;
}
