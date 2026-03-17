const { TradeLog, EVENT_TYPES } = require('../models/TradeLog');

/**
 * Log a WEBHOOK_ACCEPTED event.
 * Called when a chartink webhook payload is received and starts processing.
 */
const logWebhookAccepted = async ({ scan_name, triggered_at, stocks, direction }) => {
  try {
    await TradeLog.create({
      event: EVENT_TYPES.WEBHOOK_ACCEPTED,
      scan_name,
      triggered_at,
      direction,
      details: { stocks }
    });
  } catch (err) {
    console.error('[TradeLog] Failed to log WEBHOOK_ACCEPTED:', err.message);
  }
};

/**
 * Log a TRADE_EXECUTED event.
 * Called right after a buy/sell order is placed successfully.
 */
const logTradeExecuted = async ({
  chartink_name,
  fyers_name,
  direction,
  quantity,
  scan_name,
  triggered_at,
  orderResponse
}) => {
  try {
    await TradeLog.create({
      event: EVENT_TYPES.TRADE_EXECUTED,
      chartink_name,
      fyers_name,
      direction,
      quantity,
      scan_name,
      triggered_at,
      details: orderResponse
    });
  } catch (err) {
    console.error('[TradeLog] Failed to log TRADE_EXECUTED:', err.message);
  }
};

/**
 * Log a TRADE_EXITED event.
 * Called after the exit (square-off) order is placed.
 */
const logTradeExited = async ({
  chartink_name,
  fyers_name,
  direction,
  quantity,
  entryPrice,
  exitPrice,
  pnl_pct,
  reason,
  exitResponse
}) => {
  try {
    await TradeLog.create({
      event: EVENT_TYPES.TRADE_EXITED,
      chartink_name,
      fyers_name,
      direction,
      quantity,
      price: exitPrice,
      pnl_pct,
      reason,
      details: { entryPrice, exitPrice, exitResponse }
    });
  } catch (err) {
    console.error('[TradeLog] Failed to log TRADE_EXITED:', err.message);
  }
};

module.exports = { logWebhookAccepted, logTradeExecuted, logTradeExited };
