import pool from "../../db/db.js";

export async function getConversationSummary(conversationId, userId) {
  const { rows } = await pool.query(
    "SELECT summary FROM chat_conversations WHERE id = $1 AND user_id = $2",
    [conversationId, userId],
  );
  return rows[0]?.summary || null;
}

export async function getConversationSummaryWithMeta(conversationId, userId) {
  const { rows } = await pool.query(
    "SELECT summary, summarized_up_to FROM chat_conversations WHERE id = $1 AND user_id = $2",
    [conversationId, userId],
  );
  return rows[0] || { summary: null, summarized_up_to: 0 };
}

export async function getMessageCount(conversationId, userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM chat_messages
     WHERE conversation_id = $1
     AND EXISTS (SELECT 1 FROM chat_conversations WHERE id = $1 AND user_id = $2)`,
    [conversationId, userId],
  );
  return rows[0].count;
}

export async function getMessagesForSummarization(conversationId, userId, offset, limit) {
  const { rows } = await pool.query(
    `SELECT role, content FROM chat_messages
     WHERE conversation_id = $1
     AND EXISTS (SELECT 1 FROM chat_conversations WHERE id = $1 AND user_id = $2)
     ORDER BY created_at ASC
     OFFSET $3 LIMIT $4`,
    [conversationId, userId, offset, limit],
  );
  return rows;
}

export async function updateConversationSummary(conversationId, userId, summary, summarizedUpTo) {
  await pool.query(
    `UPDATE chat_conversations
     SET summary = $3, summarized_up_to = $4, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId, summary, summarizedUpTo],
  );
}

export async function getOrCreateConversation(userId, conversationId) {
  if (conversationId) {
    const result = await pool.query(
      "SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    if (result.rows.length > 0) return conversationId;
  }
  const result = await pool.query(
    "INSERT INTO chat_conversations (user_id) VALUES ($1) RETURNING id",
    [userId]
  );
  return result.rows[0].id;
}

export async function getConversationMessages(conversationId, userId, limit = 10) {
  const result = await pool.query(
    `SELECT role, content FROM chat_messages
     WHERE conversation_id = $1
     AND EXISTS (SELECT 1 FROM chat_conversations WHERE id = $1 AND user_id = $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [conversationId, userId, limit]
  );
  return result.rows.reverse();
}

export async function saveMessage(conversationId, role, content, pageContext = null) {
  await pool.query(
    `INSERT INTO chat_messages (conversation_id, role, content, page_context)
     VALUES ($1, $2, $3, $4)`,
    [conversationId, role, content, pageContext ? JSON.stringify(pageContext) : null]
  );
  await pool.query(
    "UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1",
    [conversationId]
  );
}
