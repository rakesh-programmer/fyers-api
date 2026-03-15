const express = require('express');

const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');

const app = express();

app.use(express.json());
app.use(authRoutes);
app.use('/api/trade', tradeRoutes);

module.exports = app;
