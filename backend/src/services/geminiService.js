// backend/src/services/geminiService.js
// Handles all Gemini API communication with real streaming, function calling,
// request cancellation, retry with backoff, and model fallback.

const { genAI, env } = require('../config/gemini');
const financialTools = require('./financialTools');

const MAX_TOOL_ROUNDS = 5;
const GENERATION_TIMEOUT_MS = 45000;

// ── System instruction ────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are SmartSpend AI, a helpful, friendly, and concise personal financial assistant built into the SmartSpend application.

RESPONSE FORMAT & LENGTH RULES (STRICT):
- DEFAULT RESPONSE LENGTH: 80 to 150 words. Be concise, direct, and actionable.
- Simple questions: 1 to 4 sentences.
- Financial analysis: Provide a short summary with relevant figures, followed by a brief takeaway.
- Recommendations: Maximum 3 to 5 clear, bulleted, actionable suggestions based on actual figures.
- Avoid lengthy conversational filler, preamble, repetitive introductions, or generic disclaimers.
- Do NOT generate long generic guides or essays unless the user explicitly asks for "detailed explanation" or "in-depth breakdown".
- Currency: Indian Rupees (₹). Always format money with the ₹ symbol (e.g., ₹12,500).
- Format your responses in clean Markdown with bolding for numbers and bullet points for lists.

FINANCIAL DATA & TOOL USAGE RULES:
1. DISTINGUISH PERSONAL VS GENERAL QUESTIONS:
   A. PERSONAL FINANCIAL QUESTIONS:
      - Examples: "How much did I spend this month?", "Where is most of my money going?", "How can I save more money?", "Am I spending too much?", "How can I reduce my food expenses?", "Show my top 5 expenses", "Compare this month with last month", "Which category should I reduce?".
      - For ANY question regarding the user's spending, savings, categories, or financial records: YOU MUST CALL THE RELEVANT FINANCIAL TOOLS FIRST before responding.
      - For "How can I save more money?", ALWAYS call getFinancialSummary and getCategoryBreakdown to examine actual spending, then give 3 to 5 realistic recommendations based on their highest expense categories.
      - Never guess, invent, or fabricate financial numbers. Only cite figures returned by your tools.
      - If no transactions exist for the requested timeframe, clearly explain that no matching records were found in SmartSpend.
   B. GENERAL FINANCIAL EDUCATION QUESTIONS:
      - Examples: "Explain the 50/30/20 rule", "What is an emergency fund?", "What is compound interest?", "Difference between saving and investing?".
      - Answer these directly using general financial knowledge WITHOUT calling any financial tools. Keep answers under 120 words.
   C. MIXED QUESTIONS:
      - Example: "Explain the 50/30/20 rule and how my spending compares."
      - Retrieve the user's data with tools, briefly explain the rule, and compare their actual percentages.

2. ADVICE & SAFETY:
   - Provide spending insights and practical budget tips, not formal investment or legal advice.
   - Never expose internal tool names, SQL queries, or backend schema details.`;

// ── Gemini tool declarations ──────────────────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'getFinancialSummary',
    description: "Get user's total income, expenses, and balance for a date range. Always use for spending/income/balance questions.",
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:   { type: 'STRING', description: 'End date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'getCategoryBreakdown',
    description: 'Get expense distribution broken down by category. Always use for questions like where money went or highest expenses.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:   { type: 'STRING', description: 'End date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'getMonthlyComparison',
    description: "Compare this month's income and expenses with last month.",
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'getSpendingTrend',
    description: 'Get spending and income trend over a period grouped by daily, weekly, or monthly.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:   { type: 'STRING', description: 'End date YYYY-MM-DD' },
        grouping:  { type: 'STRING', description: 'daily, weekly, or monthly', enum: ['daily', 'weekly', 'monthly'] },
      },
    },
  },
  {
    name: 'getTopExpenses',
    description: 'Find the largest individual expense transactions (e.g. top 5 expenses).',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:   { type: 'STRING', description: 'End date YYYY-MM-DD' },
        limit:     { type: 'NUMBER', description: 'Number of results (max 20, default 5)' },
      },
    },
  },
  {
    name: 'searchTransactions',
    description: "Search and filter the user's transactions by date, category, type, amount, or keyword.",
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate:       { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:         { type: 'STRING', description: 'End date YYYY-MM-DD' },
        category:        { type: 'STRING', description: 'Category name' },
        transactionType: { type: 'STRING', description: 'expense or income', enum: ['expense', 'income'] },
        minAmount:       { type: 'NUMBER', description: 'Minimum amount' },
        maxAmount:       { type: 'NUMBER', description: 'Maximum amount' },
        description:     { type: 'STRING', description: 'Keyword in note' },
        limit:           { type: 'NUMBER', description: 'Limit (max 50)' },
      },
    },
  },
  {
    name: 'getPaymentMethodBreakdown',
    description: 'Get spending grouped by payment method (Cash, UPI, Credit Card, etc.).',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:   { type: 'STRING', description: 'End date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'getAverageDailyExpense',
    description: "Calculate the user's average daily expense for a period.",
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:   { type: 'STRING', description: 'End date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'getIncomeHistory',
    description: "Retrieve the user's income transactions for a period.",
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:   { type: 'STRING', description: 'End date YYYY-MM-DD' },
        limit:     { type: 'NUMBER', description: 'Number of results (max 50)' },
      },
    },
  },
  {
    name: 'getExpenseHistory',
    description: "Retrieve the user's expense transactions for a period.",
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        endDate:   { type: 'STRING', description: 'End date YYYY-MM-DD' },
        limit:     { type: 'NUMBER', description: 'Number of results (max 50)' },
      },
    },
  },
];

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sendEvent(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Resilient retry with backoff & fallback ───────────────────────────────────

async function withRetry(fn, maxRetries = 1) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const is503 =
        err.status === 503 ||
        err.message?.includes('503') ||
        err.message?.includes('UNAVAILABLE');

      if (is503 && attempt <= maxRetries) {
        const delay = Math.pow(2, attempt) * 300 + Math.random() * 200;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

async function callGemini(methodName, params) {
  const primaryModel = env.geminiModel || 'gemini-3.1-flash-lite';
  const fallbackModel = env.geminiFallbackModel || 'gemini-3.5-flash';

  try {
    return await withRetry(() =>
      genAI.models[methodName]({ ...params, model: primaryModel })
    );
  } catch (err) {
    const canFallback =
      (err.status === 503 ||
        err.status === 404 ||
        err.status === 429 ||
        err.message?.includes('503') ||
        err.message?.includes('404') ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED') ||
        err.message?.includes('UNAVAILABLE')) &&
      primaryModel !== fallbackModel;

    if (canFallback) {
      console.warn(
        `[geminiService] Model ${primaryModel} failed (${err.message.slice(0, 120)}). Retrying with fallback model ${fallbackModel}...`
      );
      return await withRetry(() =>
        genAI.models[methodName]({ ...params, model: fallbackModel })
      );
    }
    throw err;
  }
}

// ── Main streaming handler ────────────────────────────────────────────────────

async function streamChatResponse({
  req,
  res,
  userId,
  userMessage,
  history,
  conversationSummary,
  messageId,
  conversationId,
}) {
  if (!env.geminiApiKey) {
    sendEvent(res, 'error', {
      message: 'SmartSpend AI is not configured. Please set the GEMINI_API_KEY in the server environment.',
    });
    return '';
  }

  let clientDisconnected = false;
  if (req) {
    req.on('close', () => {
      clientDisconnected = true;
    });
  }

  // Prepend summary context if available
  let systemWithSummary = SYSTEM_INSTRUCTION;
  if (conversationSummary && conversationSummary.trim()) {
    systemWithSummary += `\n\n[Prior Conversation Summary]\n${conversationSummary}`;
  }

  // Build working context
  const runContents = [...history, { role: 'user', parts: [{ text: userMessage }] }];

  let toolRound = 0;
  let fullResponse = '';
  let timeoutTriggered = false;

  const timer = setTimeout(() => {
    timeoutTriggered = true;
    if (!res.writableEnded && !clientDisconnected) {
      sendEvent(res, 'error', { message: 'Generation timed out. Please try again.' });
    }
  }, GENERATION_TIMEOUT_MS);

  try {
    // ── 1. Function Calling Tool Resolution Loop ─────────────────────────────
    while (toolRound < MAX_TOOL_ROUNDS) {
      if (clientDisconnected || timeoutTriggered) break;

      const response = await callGemini('generateContent', {
        contents: runContents,
        config: {
          systemInstruction: systemWithSummary,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          temperature: 0.3,
          maxOutputTokens: 700,
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) break;

      const functionCalls = response.functionCalls;

      if (!functionCalls || functionCalls.length === 0) {
        // No tools requested
        if (toolRound === 0) {
          // General question without tools: candidate already contains the complete text
          fullResponse =
            response.text ||
            candidate.content?.parts?.filter((p) => p.text).map((p) => p.text).join('') ||
            '';
        }
        break;
      }

      // Execute approved tools
      const toolResults = [];
      for (const fc of functionCalls) {
        const { name, args } = fc;
        let result;
        try {
          result = await financialTools.dispatch(name, userId, args || {});
        } catch (err) {
          console.error(`[geminiService] Tool "${name}" error:`, err.message);
          result = { error: `Tool execution failed: ${err.message}` };
        }
        toolResults.push({
          functionResponse: {
            name,
            response: { result },
          },
        });
      }

      // Preserve candidate.content intact so thoughtSignature is preserved
      runContents.push(candidate.content);
      runContents.push({ role: 'user', parts: toolResults });
      toolRound++;
    }

    if (clientDisconnected || timeoutTriggered) {
      return '';
    }

    // ── 2. Stream the Answer ──────────────────────────────────────────────────
    sendEvent(res, 'start', { messageId });

    if (toolRound === 0 && fullResponse) {
      // General question without tools: stream the direct response
      sendEvent(res, 'delta', { text: fullResponse });
    } else {
      // Tools were executed: stream the final answer progressively using generateContentStream
      const stream = await callGemini('generateContentStream', {
        contents: runContents,
        config: {
          systemInstruction: systemWithSummary,
          temperature: 0.3,
          maxOutputTokens: 700,
        },
      });

      for await (const chunk of stream) {
        if (clientDisconnected || timeoutTriggered || res.writableEnded) break;
        const text = chunk.text;
        if (text) {
          fullResponse += text;
          sendEvent(res, 'delta', { text });
        }
      }
    }

    if (clientDisconnected || timeoutTriggered) {
      return '';
    }

    if (!fullResponse.trim()) {
      fullResponse = "I'm sorry, I wasn't able to generate an answer. Please try asking again.";
      sendEvent(res, 'delta', { text: fullResponse });
    }

    sendEvent(res, 'done', { messageId, conversationId });
    return fullResponse;

  } catch (err) {
    console.error('[geminiService] Error:', err.message);

    if (!res.writableEnded && !clientDisconnected) {
      let userMsg = 'SmartSpend AI encountered an error. Please try again.';
      if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('401') || err.status === 401) {
        userMsg = 'Invalid Gemini API key. Please verify your server settings.';
      } else if (err.message?.includes('429') || err.status === 429) {
        userMsg = 'AI service is currently busy. Please wait a moment and retry.';
      } else if (err.message?.includes('503') || err.status === 503 || err.message?.includes('UNAVAILABLE')) {
        userMsg = 'AI service is temporarily experiencing high demand. Please try again in a few seconds.';
      }
      sendEvent(res, 'error', { message: userMsg });
    }
    return '';
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { streamChatResponse };
