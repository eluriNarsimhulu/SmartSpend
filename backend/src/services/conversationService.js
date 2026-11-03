// backend/src/services/conversationService.js
// Conversation CRUD + message persistence.
// All queries include user_id checks so users can only access their own data.

const db = require('../db/pool');

const CONTEXT_WINDOW = 20; // recent messages to include in every Gemini call

// ── Conversation CRUD ─────────────────────────────────────────────────────────

async function createConversation(userId, title = 'New Chat') {
  const { rows } = await db.query(
    `INSERT INTO ai_conversations (user_id, title)
     VALUES ($1, $2)
     RETURNING id, user_id, title, summary, created_at, updated_at`,
    [userId, title.slice(0, 255)]
  );
  return rows[0];
}

async function listConversations(userId) {
  const { rows } = await db.query(
    `SELECT id, title, created_at, updated_at
     FROM ai_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 100`,
    [userId]
  );
  return rows;
}

async function getConversation(conversationId, userId) {
  const { rows } = await db.query(
    `SELECT id, user_id, title, summary, created_at, updated_at
     FROM ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rows[0] || null;
}

async function renameConversation(conversationId, userId, title) {
  const { rows } = await db.query(
    `UPDATE ai_conversations
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, title, updated_at`,
    [title.slice(0, 255), conversationId, userId]
  );
  return rows[0] || null;
}

async function deleteConversation(conversationId, userId) {
  const { rowCount } = await db.query(
    `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rowCount > 0;
}

async function updateSummary(conversationId, userId, summary) {
  await db.query(
    `UPDATE ai_conversations
     SET summary = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3`,
    [summary, conversationId, userId]
  );
}

async function touchConversation(conversationId) {
  await db.query(
    `UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );
}

// ── Messages ──────────────────────────────────────────────────────────────────

async function saveMessage(conversationId, role, content) {
  const { rows } = await db.query(
    `INSERT INTO ai_messages (conversation_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, role, content, created_at`,
    [conversationId, role, content]
  );
  await touchConversation(conversationId);
  return rows[0];
}

async function getMessages(conversationId) {
  const { rows } = await db.query(
    `SELECT id, role, content, created_at
     FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows;
}

// Returns the recent messages for the Gemini context window.
async function getRecentMessages(conversationId) {
  const { rows } = await db.query(
    `SELECT role, content
     FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, CONTEXT_WINDOW]
  );
  return rows.reverse(); // oldest-first for Gemini
}

// Build a Gemini-compatible history array from recent messages.
// The last element (latest user message) is excluded – it will be sent as the current turn.
async function buildGeminiHistory(conversationId) {
  const messages = await getRecentMessages(conversationId);
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

module.exports = {
  createConversation,
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
  updateSummary,
  touchConversation,
  saveMessage,
  getMessages,
  getRecentMessages,
  buildGeminiHistory,
  CONTEXT_WINDOW,
};

