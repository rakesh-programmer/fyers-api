const { TradeLog, EVENT_TYPES } = require('../models/TradeLog');

const DEFAULT_LIMIT = 20;

/**
 * Generic paginated query on TradeLog filtered by event type.
 */
const getLogs = async (req, res, eventType) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      TradeLog.find({ event: eventType })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TradeLog.countDocuments({ event: eventType })
    ]);

    return res.status(200).json({
      event: eventType,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: logs
    });
  } catch (err) {
    console.error(`[TradeLogController] Error fetching ${eventType} logs:`, err.message);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

/**
 * GET /api/logs/webhook
 * Returns paginated WEBHOOK_ACCEPTED logs.
 * Query params: page (default 1), limit (default 20, max 100)
 */
const getWebhookLogs = (req, res) => getLogs(req, res, EVENT_TYPES.WEBHOOK_ACCEPTED);

/**
 * GET /api/logs/trade-executed
 * Returns paginated TRADE_EXECUTED logs.
 */
const getTradeExecutedLogs = (req, res) => getLogs(req, res, EVENT_TYPES.TRADE_EXECUTED);

/**
 * GET /api/logs/trade-exited
 * Returns paginated TRADE_EXITED logs.
 */
const getTradeExitedLogs = (req, res) => getLogs(req, res, EVENT_TYPES.TRADE_EXITED);

module.exports = { getWebhookLogs, getTradeExecutedLogs, getTradeExitedLogs };
