// backend/test_ai_runner.js
// Automated verification for the 7 user prompts.

require('dotenv').config();
const db = require('./src/db/pool');
const financialTools = require('./src/services/financialTools');
const geminiService = require('./src/services/geminiService');

async function runTests() {
  console.log('=== Step 1: Testing Financial Tools Calculations with DB Data ===');
  // Get first user in DB
  const userRes = await db.query('SELECT id, email FROM users ORDER BY id ASC LIMIT 1');
  if (userRes.rows.length === 0) {
    console.log('No user found in DB, skipping tool execution with user');
    return;
  }
  const testUserId = userRes.rows[0].id;
  console.log(`Using user ID: ${testUserId} (${userRes.rows[0].email})`);

  // Test summary
  const summary = await financialTools.dispatch('getFinancialSummary', testUserId, {});
  console.log('getFinancialSummary result:', JSON.stringify(summary));
  if (typeof summary.totalExpenses !== 'number' || typeof summary.totalIncome !== 'number') {
    throw new Error('Numeric conversion failed in getFinancialSummary');
  }

  // Test breakdown
  const breakdown = await financialTools.dispatch('getCategoryBreakdown', testUserId, {});
  console.log('getCategoryBreakdown result count:', breakdown.length, 'sample:', breakdown[0]);
  if (breakdown.length > 0 && typeof breakdown[0].totalAmount !== 'number') {
    throw new Error('Numeric conversion failed in getCategoryBreakdown');
  }

  // Test monthly comparison
  const comparison = await financialTools.dispatch('getMonthlyComparison', testUserId, {});
  console.log('getMonthlyComparison result:', JSON.stringify(comparison));

  // Test top expenses
  const topExpenses = await financialTools.dispatch('getTopExpenses', testUserId, { limit: 5 });
  console.log('getTopExpenses result count:', topExpenses.length);

  console.log('\n=== Step 2: Testing Real Gemini Streaming with the 7 Prompts ===');
  const prompts = [
    'How much did I spend this month?',
    'Where is most of my money going?',
    'How can I save more money?',
    'Explain the 50/30/20 rule.',
    'Compare this month with last month.',
    'Which category should I reduce?',
    'Show my top five expenses.',
  ];

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    console.log(`\n--- Test Prompt ${i + 1}: "${p}" ---`);
    let output = '';
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: (data) => {
        const lines = data.split('\n');
        for (const l of lines) {
          if (l.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(l.slice(6));
              if (parsed.text) output += parsed.text;
            } catch (_) {}
          }
        }
      },
      flushHeaders: () => {},
      end: () => { mockRes.writableEnded = true; },
    };

    const startTime = Date.now();
    await geminiService.streamChatResponse({
      req: { on: () => {} },
      res: mockRes,
      userId: testUserId,
      userMessage: p,
      history: [],
      conversationSummary: '',
      messageId: 'test-msg-' + i,
      conversationId: 'test-conv-001',
    });
    const elapsed = Date.now() - startTime;
    console.log(`Elapsed: ${elapsed}ms`);
    console.log(`Response preview: ${output.slice(0, 180)}...`);
    console.log(`Word count: ~${output.split(/\s+/).length} words`);
    // Brief pause to stay well within free tier per-minute quotas
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\nAll 7 test prompts completed successfully!');
  await db.pool.end();
}

runTests().catch(async (err) => {
  console.error('Test failed:', err);
  await db.pool.end();
  process.exit(1);
});
