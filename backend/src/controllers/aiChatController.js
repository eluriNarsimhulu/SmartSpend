// backend/src/controllers/aiChatController.js
// Thin controllers – business logic lives in the service layer.

const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const conversationService = require('../services/conversationService');
const geminiService = require('../services/geminiService');
const { maybeGenerateSummary } = require('../services/aiSummaryService');

const MAX_MESSAGE_LENGTH = 4000;

// ── Conversation endpoints ────────────────────────────────────────────────────

// POST /api/ai/conversations
const createConversation = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const title  = (req.body.title || 'New Chat').toString().slice(0, 255);
  const convo  = await conversationService.createConversation(userId, title);
  res.status(201).json(convo);
});

// GET /api/ai/conversations
const listConversations = asyncHandler(async (req, res) => {
  const convos = await conversationService.listConversations(req.user.id);
  res.json(convos);
});

// GET /api/ai/conversations/:id
const getConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const convo   = await conversationService.getConversation(id, req.user.id);
  if (!convo) throw new HttpError(404, 'Conversation not found.');

  const messages = await conversationService.getMessages(id);
  res.json({ ...convo, messages });
});

// PATCH /api/ai/conversations/:id
const renameConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const title   = (req.body.title || '').toString().trim();
  if (!title) throw new HttpError(400, 'Title is required.');

  const updated = await conversationService.renameConversation(id, req.user.id, title);
  if (!updated) throw new HttpError(404, 'Conversation not found.');
  res.json(updated);
});

// DELETE /api/ai/conversations/:id
const deleteConversation = asyncHandler(async (req, res) => {
  const { id }  = req.params;
  const deleted = await conversationService.deleteConversation(id, req.user.id);
  if (!deleted) throw new HttpError(404, 'Conversation not found.');
  res.json({ success: true });
});

// ── Message / SSE endpoint ────────────────────────────────────────────────────

// POST /api/ai/conversations/:id/messages  (SSE stream)
const sendMessage = asyncHandler(async (req, res) => {
  const userId         = req.user.id;
  const conversationId = req.params.id;
  const userText       = (req.body.message || '').toString().trim();

  // ── Validation ────────────────────────────────────────────────────────────
  if (!userText) throw new HttpError(400, 'Message cannot be empty.');
  if (userText.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`);
  }

  // ── Ownership check ───────────────────────────────────────────────────────
  const convo = await conversationService.getConversation(conversationId, userId);
  if (!convo) throw new HttpError(404, 'Conversation not found.');

  // ── Save user message ────────────────────────────────────────────────────
  const userMsg = await conversationService.saveMessage(conversationId, 'user', userText);

  // ── Set SSE headers ───────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering
  res.flushHeaders();

  // ── Build conversation context ────────────────────────────────────────────
  const history = await conversationService.buildGeminiHistory(conversationId);
  // Remove the last entry if it's the user message we just saved (it'll be sent as currentTurn)
  const historyWithoutLast = history.length > 0 && history[history.length - 1].role === 'user'
    ? history.slice(0, -1)
    : history;

  // ── Generate & stream response ────────────────────────────────────────────
  let assistantText = '';
  try {
    assistantText = await geminiService.streamChatResponse({
      res,
      userId,
      userMessage: userText,
      history: historyWithoutLast,
      conversationSummary: convo.summary,
      messageId: userMsg.id,
      conversationId,
    });
  } catch (streamErr) {
    console.error('[aiChatController] Stream error:', streamErr.message);
  }

  // ── Save assistant message ────────────────────────────────────────────────
  if (assistantText) {
    await conversationService.saveMessage(conversationId, 'assistant', assistantText);
    // Auto-title on first real exchange
    if (convo.title === 'New Chat') {
      const autoTitle = userText.slice(0, 60) + (userText.length > 60 ? '…' : '');
      await conversationService.renameConversation(conversationId, userId, autoTitle);
    }
    // Fire-and-forget rolling summary
    maybeGenerateSummary(conversationId, userId).catch(() => {});
  }

  res.end();
});

module.exports = {
  createConversation,
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
  sendMessage,
};

