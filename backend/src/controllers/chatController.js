import { runAgentLoop, summarizeOlderMessages } from "../services/chatAgentService.js";
import {
  getOrCreateConversation,
  getConversationMessages,
  getConversationSummary,
  getConversationSummaryWithMeta,
  getMessageCount,
  getMessagesForSummarization,
  updateConversationSummary,
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

async function triggerSummarization(conversationId, userId) {
  const [totalCount, meta] = await Promise.all([
    getMessageCount(conversationId, userId),
    getConversationSummaryWithMeta(conversationId, userId),
  ]);
  const summarizedUpTo = meta.summarized_up_to ?? 0;
  const existingSummary = meta.summary;

  // Only summarize if there are unsummarized messages beyond the recent window
  const unsummarizedCount = totalCount - 20; // messages outside the 20-message window
  if (unsummarizedCount <= 0 || unsummarizedCount <= summarizedUpTo) return;

  // Get messages that need to be summarized (between summarizedUpTo and the window boundary)
  const messagesToSummarize = await getMessagesForSummarization(
    conversationId,
    userId,
    summarizedUpTo,
    unsummarizedCount - summarizedUpTo,
  );
  if (messagesToSummarize.length === 0) return;

  const newSummary = await summarizeOlderMessages(messagesToSummarize, existingSummary);
  await updateConversationSummary(conversationId, userId, newSummary, unsummarizedCount);
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

  // Abort the agent loop if the client disconnects to avoid wasted LLM API calls
  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  let convoId;
  try {
    const safeContext = sanitizePageContext(pageContext);

    convoId = await getOrCreateConversation(userId, conversationId || null);
    await saveMessage(convoId, "user", cleanMessage, safeContext);

    const [history, existingSummary] = await Promise.all([
      getConversationMessages(convoId, userId, 20),
      getConversationSummary(convoId, userId),
    ]);

    const assistantContent = await runAgentLoop(history, safeContext, (delta) => {
      res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
    }, {
      onStatus: (status) => {
        res.write(`data: ${JSON.stringify({ type: "status", content: status })}\n\n`);
      },
      conversationSummary: existingSummary,
      signal: abortController.signal,
    });

    if (!abortController.signal.aborted) {
      await saveMessage(convoId, "assistant", assistantContent);
      res.write(`data: ${JSON.stringify({ type: "done", conversationId: convoId })}\n\n`);

      // Async: summarize older messages if conversation is long
      triggerSummarization(convoId, userId).catch((err) =>
        logger.warn({ err }, "Background summarization failed"),
      );
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      // Client disconnected — nothing to write, just clean up
      return;
    }
    logger.error({ err }, "Chat agent error");
    res.write(
      `data: ${JSON.stringify({ type: "error", message: "Something went wrong. Please try again." })}\n\n`
    );
  } finally {
    res.end();
  }
}
