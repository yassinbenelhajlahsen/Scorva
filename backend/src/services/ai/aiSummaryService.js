import OpenAI from "openai";
import pool from "../../db/db.js";
import logger from "../../logger.js";
import { embedGameSummary } from "./embeddingService.js";
import { getPlays } from "../games/playsService.js";
import { parseClockToSeconds, nhlClockToRemaining } from "../../utils/clock.js";
import { gradeFromRaw } from "../games/ratingEngine.js";

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

// One-possession margin per league. If the score was never within this margin
// during the clutch window, the game wasn't competitive at the end and the
// "last scoring play" is garbage time, not a game-winner.
const ONE_POSSESSION = { NBA: 5, NFL: 8, NHL: 1 };

export async function getClutchPlays(gameId, league) {
  try {
    const result = await getPlays(gameId, league);
    if (!result || !result.plays || result.plays.length === 0) {
      return { plays: [], gameWinningPlay: null };
    }

    const leagueUpper = league.toUpperCase();
    const finalRegPeriod = leagueUpper === "NHL" ? 3 : 4;
    const CLUTCH_SECONDS = 300; // 5 minutes
    const onePossession = ONE_POSSESSION[leagueUpper] ?? 5;

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

    // Game must have been within one possession at some point in the clutch
    // window. Otherwise the result was decided well before the buzzer and any
    // late scores are stat-padding, not decisive plays.
    const wasCompetitive = clutch.some((p) => {
      if (p.home_score == null || p.away_score == null) return false;
      return Math.abs(p.home_score - p.away_score) <= onePossession;
    });

    if (!wasCompetitive) {
      return { plays: [], gameWinningPlay: null };
    }

    const lastScoringPlay = [...result.plays]
      .reverse()
      .find((p) => p.scoring_play);
    const gameWinningPlay = lastScoringPlay ? mapPlay(lastScoringPlay, leagueUpper) : null;

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
      g.season,
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
      g.type as game_type,
      g.game_label,
      g.hometeamid,
      g.awayteamid,
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

// Compute the best-of-N playoff series record entering and after this game.
// Only applies to NBA/NHL playoff games whose label includes "Game N" — NFL
// is single-elim (no series) and play-in games don't carry a series record.
// Returns null otherwise so the prompt can skip series context entirely.
export async function getPlayoffSeries(game) {
  if (game?.game_type !== "playoff") return null;
  if (!game?.hometeamid || !game?.awayteamid || !game?.league) return null;
  const lg = game.league.toLowerCase();
  if (lg !== "nba" && lg !== "nhl") return null;
  if (!game.game_label || !/Game \d+/i.test(game.game_label)) return null;

  try {
    const { rows } = await pool.query(
      `SELECT g.winnerid, g.hometeamid, g.awayteamid
       FROM games g
       WHERE g.league = $1
         AND g.season = $2
         AND g.type = 'playoff'
         AND g.status = 'Final'
         AND g.id <> $3
         AND g.date < $4
         AND ((g.hometeamid = $5 AND g.awayteamid = $6)
           OR (g.hometeamid = $6 AND g.awayteamid = $5))`,
      [game.league, game.season, game.id, game.date, game.hometeamid, game.awayteamid]
    );

    let homeWins = 0;
    let awayWins = 0;
    for (const r of rows) {
      if (r.winnerid === game.hometeamid) homeWins++;
      else if (r.winnerid === game.awayteamid) awayWins++;
    }

    const thisHome = game.homescore > game.awayscore ? 1 : 0;
    const thisAway = game.awayscore > game.homescore ? 1 : 0;

    const fmt = (h, a) => {
      if (h === 0 && a === 0) return null;
      if (h === a) return `Series tied ${h}-${a}`;
      if (h > a) return `${game.home_team_name} lead ${h}-${a}`;
      return `${game.away_team_name} lead ${a}-${h}`;
    };

    const sepIdx = game.game_label.indexOf(" - ");
    const round = sepIdx > 0 ? game.game_label.slice(0, sepIdx) : game.game_label;
    const m = game.game_label.match(/Game (\d+)/i);
    const gameNumber = m ? parseInt(m[1], 10) : rows.length + 1;

    return {
      round,
      gameNumber,
      beforeThisGame: fmt(homeWins, awayWins) ?? `Series begins (Game ${gameNumber})`,
      afterThisGame: fmt(homeWins + thisHome, awayWins + thisAway),
    };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch playoff series state for AI summary");
    return null;
  }
}

// Compute each team's W/L streak going INTO this game. Looks back at the
// most recent final games before this date and counts consecutive same-result
// games. Streak length < 2 returns null (a 1-game "streak" is just yesterday).
export async function getTeamStreaks(game) {
  if (!game?.hometeamid || !game?.awayteamid) {
    return { home: null, away: null };
  }
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.date, g.hometeamid, g.awayteamid, g.homescore, g.awayscore
       FROM games g
       WHERE g.league = $1
         AND g.status = 'Final'
         AND g.date < $2
         AND (g.hometeamid = $3 OR g.awayteamid = $3
              OR g.hometeamid = $4 OR g.awayteamid = $4)
       ORDER BY g.date DESC, g.id DESC
       LIMIT 30`,
      [game.league, game.date, game.hometeamid, game.awayteamid]
    );

    const computeStreak = (teamId) => {
      const teamGames = rows.filter(
        (r) => r.hometeamid === teamId || r.awayteamid === teamId
      );
      if (teamGames.length === 0) return null;
      const wonAt = (r) =>
        r.hometeamid === teamId
          ? r.homescore > r.awayscore
          : r.awayscore > r.homescore;
      const first = wonAt(teamGames[0]);
      let len = 0;
      for (const r of teamGames) {
        if (wonAt(r) === first) len++;
        else break;
      }
      if (len < 2) return null;
      return { type: first ? "win" : "loss", length: len };
    };

    return {
      home: computeStreak(game.hometeamid),
      away: computeStreak(game.awayteamid),
    };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch team streaks for AI summary");
    return { home: null, away: null };
  }
}

// Detect players who likely left this game with an injury, or played
// limited time due to one. Heuristic: low usage + popularity + a
// historical injury-status change recorded close to the game date (via
// player_status_history). NBA uses minutes < 15; NHL uses TOI < 8:00 and
// excludes goalies (a pulled goalie has low TOI but isn't injured).
const INJURY_STATUSES = "('day-to-day', 'questionable', 'doubtful', 'out', 'ir')";
export async function getInGameInjuries(gameId, league, gameDate) {
  const lg = league?.toLowerCase();
  if (lg !== "nba" && lg !== "nhl") return [];
  if (!gameDate) return [];

  const usageSelect = lg === "nba" ? "s.minutes AS minutes, NULL AS toi" : "NULL AS minutes, s.toi AS toi";
  const usageFilter = lg === "nba"
    ? "s.minutes IS NOT NULL AND s.minutes > 0 AND s.minutes < 15"
    : `s.toi ~ '^[0-9]+:[0-9]+$'
       AND (p.position IS NULL OR p.position <> 'G')
       AND (split_part(s.toi, ':', 1)::int * 60 + split_part(s.toi, ':', 2)::int) > 0
       AND (split_part(s.toi, ':', 1)::int * 60 + split_part(s.toi, ':', 2)::int) < 480`;

  try {
    const result = await pool.query(
      `SELECT name, status, description, minutes, toi, team_short
       FROM (
         SELECT DISTINCT ON (p.id)
           p.name,
           p.popularity,
           psh.new_status AS status,
           psh.new_status_description AS description,
           ${usageSelect},
           t.shortname AS team_short
         FROM stats s
         JOIN players p ON p.id = s.playerid
         JOIN teams t ON t.id = COALESCE(s.teamid, p.teamid)
         JOIN player_status_history psh ON psh.player_id = p.id
         WHERE s.gameid = $1
           AND p.popularity > 50
           AND psh.new_status IN ${INJURY_STATUSES}
           AND psh.changed_at >= ($2::date - INTERVAL '1 day')
           AND psh.changed_at <= ($2::date + INTERVAL '2 days')
           AND ${usageFilter}
         ORDER BY p.id, psh.changed_at DESC
       ) sub
       ORDER BY popularity DESC
       LIMIT 5`,
      [gameId, gameDate]
    );
    return result.rows.map((r) => ({
      name: r.name,
      team: r.team_short,
      ...(r.minutes != null ? { minutes: r.minutes } : {}),
      ...(r.toi != null ? { toi: r.toi } : {}),
      status: r.status,
      description: r.description,
    }));
  } catch (err) {
    logger.warn({ err }, "Failed to fetch in-game injuries for AI summary");
    return [];
  }
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

export function buildGameData(game, stats, clutchData = {}, extras = {}) {
  const { plays: clutchPlays = [], gameWinningPlay = null } = clutchData;
  const { injuries = [], streaks = null, series = null } = extras;
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
  const topByRating = league === "NBA" ? getTopByRating(stats) : null;

  const homeStats = calculateTeamStats(
    stats.filter((s) => s.team_short === game.home_team_short),
    league
  );
  const awayStats = calculateTeamStats(
    stats.filter((s) => s.team_short === game.away_team_short),
    league
  );

  let benchPointsSwing = null;
  if (homeStats.benchPoints != null && awayStats.benchPoints != null) {
    const diff = Math.abs(homeStats.benchPoints - awayStats.benchPoints);
    if (diff > 0) {
      benchPointsSwing = {
        team: homeStats.benchPoints > awayStats.benchPoints
          ? game.home_team_name
          : game.away_team_name,
        diff,
      };
    }
  }

  // Streaks: only surface long ones (5+), and skip in playoffs where
  // series context dominates and a regular-season streak is noise.
  let streakContext = null;
  if (streaks && game.game_type !== "playoff") {
    const MIN_STREAK = 5;
    const homeStreak = streaks.home && streaks.home.length >= MIN_STREAK
      ? { team: game.home_team_name, ...streaks.home }
      : null;
    const awayStreak = streaks.away && streaks.away.length >= MIN_STREAK
      ? { team: game.away_team_name, ...streaks.away }
      : null;
    if (homeStreak || awayStreak) {
      streakContext = { home: homeStreak, away: awayStreak };
    }
  }

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
    ...(topByRating && topByRating.length > 0 ? { topByRating } : {}),
    teamStats: {
      home: homeStats,
      away: awayStats,
    },
    ...(benchPointsSwing ? { benchPointsSwing } : {}),
    ...(streakContext ? { enteringStreaks: streakContext } : {}),
    ...(game.game_type ? { gameType: game.game_type } : {}),
    ...(game.game_label ? { gameLabel: game.game_label } : {}),
    ...(series ? { seriesState: series } : {}),
    ...(injuries.length > 0 ? { inGameInjuries: injuries } : {}),
    ...(filteredClutchPlays.length > 0 ? { clutchPlays: filteredClutchPlays } : {}),
    ...(filteredGameWinner ? { gameWinningPlay: filteredGameWinner } : {}),
  };
}

// NBA-only: top 3 players by Scorva's per-game rating (impact score that
// blends box-score with WPA). Surfaces players who shaped the result through
// non-scoring contributions (defense, rebounding, late-game stops) — these
// often differ from the points leaders.
export function getTopByRating(stats) {
  const rated = stats
    .filter((s) => s.rating != null)
    .map((s) => ({ s, raw: Number(s.rating) }))
    .filter((r) => Number.isFinite(r.raw));
  if (rated.length === 0) return [];
  rated.sort((a, b) => b.raw - a.raw);
  return rated.slice(0, 3).map(({ s, raw }) => {
    const pm = s.plusminus;
    const pmStr = pm == null ? "0" : `${pm > 0 ? "+" : ""}${pm}`;
    return {
      name: s.player_name,
      team: s.team_short,
      stats: `${s.points || 0} PTS, ${s.rebounds || 0} REB, ${s.assists || 0} AST, ${s.steals || 0} STL, ${s.blocks || 0} BLK, ${pmStr} +/-, ${s.minutes || 0} MIN`,
      ratingGrade: Math.round(gradeFromRaw(raw) * 10) / 10,
    };
  });
}

export function getTopPerformers(stats, league) {
  const performers = [];

  if (league === "NBA") {
    const sortedScorers = stats
      .filter((s) => s.points > 0)
      .sort((a, b) => b.points - a.points);

    // Guarantee each team's top scorer is represented before filling by points,
    // so the winning team's anchor isn't crowded out by the loser's role players.
    const picked = new Map();
    const teams = [...new Set(sortedScorers.map((s) => s.team_short))];
    for (const team of teams) {
      const top = sortedScorers.find((s) => s.team_short === team);
      if (top) picked.set(top.player_name, top);
    }
    for (const s of sortedScorers) {
      if (picked.size >= 3) break;
      if (!picked.has(s.player_name)) picked.set(s.player_name, s);
    }

    performers.push(
      ...[...picked.values()].slice(0, 3).map((s) => {
        const rating = s.rating != null ? Number(s.rating) : null;
        const grade = rating == null ? null : gradeFromRaw(rating);
        return {
          name: s.player_name,
          team: s.team_short,
          stats: `${s.points} PTS, ${s.rebounds || 0} REB, ${s.assists || 0} AST`,
          ...(grade != null ? { ratingGrade: Math.round(grade * 10) / 10 } : {}),
        };
      })
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
    const sumMadeAtt = (col) => {
      const made = teamStats.reduce((sum, s) => {
        const v = s[col] ? s[col].split("-")[0] : "0";
        return sum + (parseInt(v) || 0);
      }, 0);
      const att = teamStats.reduce((sum, s) => {
        const v = s[col] ? s[col].split("-")[1] : "0";
        return sum + (parseInt(v) || 0);
      }, 0);
      return { made, att };
    };
    const fg = sumMadeAtt("fg");
    const three = sumMadeAtt("threept");

    // Bench scoring: top 5 by minutes are starters in NBA, rest are bench.
    const sortedByMinutes = [...teamStats].sort(
      (a, b) => (b.minutes || 0) - (a.minutes || 0)
    );
    const benchPoints = sortedByMinutes
      .slice(5)
      .reduce((sum, s) => sum + (s.points || 0), 0);

    return {
      points: totalPoints,
      rebounds: totalRebounds,
      assists: totalAssists,
      fgPct: fg.att > 0 ? ((fg.made / fg.att) * 100).toFixed(1) + "%" : "0%",
      threePoint: `${three.made}-${three.att}`,
      threePtPct:
        three.att > 0 ? ((three.made / three.att) * 100).toFixed(1) + "%" : "0%",
      benchPoints,
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
      model: "gpt-5-mini",
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
      max_completion_tokens: 300,
      reasoning_effort: "minimal",
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
        model: "gpt-5-mini",
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
        max_completion_tokens: 300,
        reasoning_effort: "minimal",
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

  let seriesContext = "";
  if (gameData.seriesState) {
    const s = gameData.seriesState;
    const before = s.beforeThisGame.startsWith("Series begins")
      ? s.beforeThisGame
      : `it was "${s.beforeThisGame}" entering this game`;
    seriesContext = `\nSeries context: ${s.round}, Game ${s.gameNumber}. After this game, "${s.afterThisGame}" (${before}). Use these strings as the source of truth for the series record — never invent or estimate it. Series stakes matter, but don't formulaically lead with them.`;
  } else if (gameData.gameType === "playoff" && gameData.gameLabel) {
    seriesContext = `\nPlayoff context: this is ${gameData.gameLabel}.`;
  }

  const injuryRule = gameData.inGameInjuries?.length
    ? `\n- Factor inGameInjuries into your analysis. Each entry shows a player whose playing time (minutes for NBA, TOI for NHL) was unusually limited and who had an injury status set around the game date — they likely left the game or played hurt. If a notable player is in the list, one bullet should mention this as a contributing factor.`
    : "";

  const streakRule = gameData.enteringStreaks
    ? `\n- enteringStreaks shows long W/L streaks (5+ games) going INTO this game. Only reference a streak if it genuinely shaped the matchup or result — do not lead with it, and do not mention it just because it exists. If the streak isn't load-bearing for the story, ignore it entirely.`
    : "";

  const benchRule = gameData.benchPointsSwing
    ? `\n- A bench-scoring differential is provided — the number represents the SWING (the gap between the two benches), not one team's total. Use it precisely as a margin (e.g. "${gameData.benchPointsSwing.team}'s bench outscored the opposition by ${gameData.benchPointsSwing.diff}"), and never name the field itself in the bullet.`
    : "";

  const ratingRule = gameData.topByRating?.length
    ? `\n- topByRating is an INTERNAL scouting signal that points to high-impact players (combines box-score with win-probability swing, NBA only). Use it to spot anyone who ranks high here but is absent from topPerformers — that player shaped the game without scoring much. If you reference such a player, anchor the observation in their concrete box-score line from the topByRating entry (e.g. "+18 in 31 minutes with 4 steals and 9 assists"), not in vague impact language. NEVER mention the rating, "Scorva," "ratings list," "impact score," "high mark/grade," or any meta-phrase about the data — the reader sees a basketball observation, not a reference to your inputs. Avoid filler like "factored into late stops," "non-scoring impact," or "helped close possessions"; if you can't cite something concrete from the data, drop the angle entirely. Don't force this into any specific bullet — only surface it when the non-scorer is actually one of the three most distinctive observations of the game.`
    : "";

  const winningPlayRule = gameData.gameWinningPlay
    ? "\n- gameWinningPlay shows the decisive late moment — the game was within one possession in the clutch. Reference it by player name in one bullet; placement is up to you, and you can combine it with other context (a performer's night, a defensive sequence, etc.) when natural."
    : gameData.clutchPlays
      ? "\n- Reference a specific late-game moment from the clutchPlays data when it shaped the result."
      : "";

  return `Summarize this ${league} game for a knowledgeable fan using exactly 3 bullet points.

Narrative frame: ${frame}${seriesContext}

Rules:
- Start each bullet with a dash (-)
- Do NOT restate the final score as a bullet — the reader already knows it
- Anchor each bullet to something specific in the game data: a player performance, a period swing, a statistical gap, a late-game play, or context (series, injuries, streaks)
- Never echo input field names in the bullets (e.g. "benchPointsSwing," "storyType," "topByRating," "seriesState," "gameWinningPlay," "enteringStreaks," "topPerformers," "inGameInjuries"). They are internal labels — translate them into natural sportswriter language
- Vary the structure — don't follow a fixed template (e.g. series-then-performer-then-final-play). Combine ideas across bullets when they reinforce each other, and skip a category entirely if forcing it would produce filler
- Pick the three most distinctive observations for THIS specific game; the storyType and topPerformers are anchors, not a checklist${winningPlayRule}${ratingRule}${injuryRule}${streakRule}${benchRule}

Game data:
${JSON.stringify(gameData, null, 2)}`;
}
