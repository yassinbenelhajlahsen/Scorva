import { runAgentLoop } from "../services/chatAgentService.js";
import {
  getOrCreateConversation,
  getConversationMessages,
  saveMessage,
} from "../services/chatHistoryService.js";
import logger from "../logger.js";

const ALLOWED_CONTEXT_TYPES = new Set(["player", "team", "game", "league"]);
const ALLOWED_LEAGUES = new Set(["nba", "nfl", "nhl"]);

const SLUG_RE = /^[a-z0-9-]{1,100}$/;

function sanitizePageContext(ctx) {
  if (!ctx || typeof ctx !== "object" || Array.isArray(ctx)) return null;
  const type = typeof ctx.type === "string" ? ctx.type : null;
  if (!type || !ALLOWED_CONTEXT_TYPES.has(type)) return null;
  const league = typeof ctx.league === "string" && ALLOWED_LEAGUES.has(ctx.league.toLowerCase())
    ? ctx.league.toLowerCase()
    : null;
  const playerSlug = typeof ctx.playerSlug === "string" && SLUG_RE.test(ctx.playerSlug) ? ctx.playerSlug : null;
  const teamSlug = typeof ctx.teamSlug === "string" && SLUG_RE.test(ctx.teamSlug) ? ctx.teamSlug : null;
  const gameId = Number.isInteger(ctx.gameId) ? ctx.gameId : null;
  return { type, league, playerSlug, teamSlug, gameId };
}

export async function streamChat(req, res) {
  const { message, conversationId, pageContext } = req.body;
  const userId = req.user.id;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message too long (max 2000 characters)" });
  }

  // Strip null bytes and non-printable control characters (injection hygiene)
  const cleanMessage = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  if (!cleanMessage) {
    return res.status(400).json({ error: "Message is required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let convoId;
  try {
    const safeContext = sanitizePageContext(pageContext);

    convoId = await getOrCreateConversation(userId, conversationId || null);
    await saveMessage(convoId, "user", cleanMessage, safeContext);

    const history = await getConversationMessages(convoId, 20);

    const assistantContent = await runAgentLoop(history, safeContext, (delta) => {
      res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
    });

    await saveMessage(convoId, "assistant", assistantContent);
    res.write(`data: ${JSON.stringify({ type: "done", conversationId: convoId })}\n\n`);
  } catch (err) {
    logger.error({ err }, "Chat agent error");
    res.write(
      `data: ${JSON.stringify({ type: "error", message: "Something went wrong. Please try again." })}\n\n`
    );
  } finally {
    res.end();
  }
}
