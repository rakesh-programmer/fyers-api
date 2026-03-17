const express = require('express');

const authRoutes = require('./routes/authRoutes');
const githubRoutes = require('./routes/githubRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const chartinkWebhookRoutes = require('./routes/chartinkWebhookRoutes');
const chartinkSellWebhookRoutes = require('./routes/chartinkSellWebhookRoutes');
const tradeLogRoutes = require('./routes/tradeLogRoutes');

const app = express();

app.use(githubRoutes);
app.use(express.json());
app.use(authRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/webhook', chartinkWebhookRoutes);
app.use('/api/webhook', chartinkSellWebhookRoutes);
app.use('/api/logs', tradeLogRoutes);

module.exports = app;
