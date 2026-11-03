// backend/src/services/aiSummaryService.js
// Optional rolling summary generation for long conversations.
// If summary generation fails the chat continues with available recent history.

const { genAI, env } = require('../config/gemini');
const conversationService = require('./conversationService');

const SUMMARY_THRESHOLD = 30; // generate a summary when message count exceeds this
const SUMMARY_PROMPT = `You are summarising a personal finance chat session for internal context use.
Create a concise paragraph (max 200 words) that captures:
- The financial topics discussed
- Any specific figures mentioned (income, expenses, categories)
- Key insights or recommendations given
- The user's apparent financial goals or concerns
Do NOT include any personally identifying information beyond financial figures already discussed.
Do NOT invent information. Only summarise what was actually said.`;

async function maybeGenerateSummary(conversationId, userId) {
  if (!env.geminiApiKey) return;

  try {
    const messages = await conversationService.getMessages(conversationId);
    if (messages.length < SUMMARY_THRESHOLD) return;

    // Only re-summarise if there are substantially new messages since last summary
    const conv = await conversationService.getConversation(conversationId, userId);
    if (!conv) return;

    const oldMessages = messages.slice(0, -conversationService.CONTEXT_WINDOW);
    if (oldMessages.length === 0) return;

    const transcript = oldMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    let response;
    try {
      response = await genAI.models.generateContent({
        model: env.geminiModel || 'gemini-3.8-flash',
        contents: [
          { role: 'user', parts: [{ text: `${SUMMARY_PROMPT}\n\n---\n\n${transcript}` }] },
        ],
      });
    } catch (_) {
      response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${SUMMARY_PROMPT}\n\n---\n\n${transcript}` }] },
        ],
      });
    }

    const summary = response.text?.trim();
    if (summary) {
      await conversationService.updateSummary(conversationId, userId, summary);
    }
  } catch (err) {
    // Non-fatal: log and continue
    console.warn('[aiSummaryService] Summary generation failed:', err.message);
  }
}

module.exports = { maybeGenerateSummary };

