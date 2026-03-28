-- Rolling summary of older messages for long conversations
ALTER TABLE chat_conversations ADD COLUMN summary TEXT;
-- Track how many messages have been summarized so we don't re-summarize
ALTER TABLE chat_conversations ADD COLUMN summarized_up_to INTEGER NOT NULL DEFAULT 0;
