const express = require('express');
const {
  getWebhookLogs,
  getTradeExecutedLogs,
  getTradeExitedLogs
} = require('../controllers/tradeLogController');

const router = express.Router();

// GET /api/logs/webhook          — webhook accepted logs
router.get('/webhook', getWebhookLogs);

// GET /api/logs/trade-executed   — trade executed logs
router.get('/trade-executed', getTradeExecutedLogs);

// GET /api/logs/trade-exited     — trade exited logs (includes P&L %)
router.get('/trade-exited', getTradeExitedLogs);

module.exports = router;
