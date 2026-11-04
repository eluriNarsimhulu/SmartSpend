const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/ai/conversations', require('./routes/aiChatRoutes'));

app.use(notFound);
app.use(errorHandler);

// app.listen(env.port, () => {
//   console.log(`SmartSpend API running on http://localhost:${env.port}`);
// });
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartSpend API running on port ${PORT}`);
});