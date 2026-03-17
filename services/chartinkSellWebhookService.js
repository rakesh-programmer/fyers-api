const Watchlist = require('../models/Watchlist');
const Trade = require('../models/Trade');
const { executeTrade } = require('./tradeService');

const TARGET_PCT = 0.6;
const STOP_LOSS_PCT = 0.6;
const SELL_SIDE = -1;

/**
 * Processes a Chartink webhook payload as SELL orders.
 * Shares the same Trade guard — if a stock was already bought OR sold today,
 * it will be skipped.
 */
const processChartinkSellWebhook = async (payload) => {
  const { stocks, scan_name, triggered_at, alert_name } = payload;

  if (!stocks) {
    throw new Error('Missing "stocks" field in payload');
  }

  const stockList = stocks
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const alertLabel = alert_name || scan_name;
  console.log(`[Chartink Sell Webhook] Alert: "${alertLabel}" at ${triggered_at}`);
  console.log(`[Chartink Sell Webhook] Stocks: ${stockList.join(', ')}`);

  const traded = [];
  const skipped = [];
  const errors = [];

  const tradePromises = stockList.map(async (chartinkName) => {
    try {
      // 1. Find matching watchlist entry
      const watchlistEntry = await Watchlist.findOne({ chartink_name: chartinkName });

      if (!watchlistEntry) {
        console.log(`[Chartink Sell Webhook] "${chartinkName}" not in watchlist — skipping.`);
        skipped.push({ chartink_name: chartinkName, reason: 'Not in watchlist' });
        return;
      }

      const { _id: watchlistId, fyers_name, quantity } = watchlistEntry;

      // 2. Check if already traded today (buy OR sell)
      const alreadyTraded = await Trade.findOne({ watchlistId });

      if (alreadyTraded) {
        console.log(
          `[Chartink Sell Webhook] "${chartinkName}" already traded today (${alreadyTraded.trade_type}) — skipping.`
        );
        skipped.push({ chartink_name: chartinkName, reason: 'Already traded today' });
        return;
      }

      console.log(
        `[Chartink Sell Webhook] Processing "${chartinkName}" → Fyers: "${fyers_name}", Qty: ${quantity}`
      );

      // 3. Place SELL order
      const result = await executeTrade(fyers_name, quantity, TARGET_PCT, STOP_LOSS_PCT, SELL_SIDE);

      if (result.success) {
        // 4. Record trade to block repeats for the rest of the day
        await Trade.create({
          watchlistId,
          chartink_name: chartinkName,
          fyers_name,
          quantity,
          scan_name: alertLabel,
          triggered_at
        });

        traded.push({ chartink_name: chartinkName, fyers_name, quantity });
        console.log(`[Chartink Sell Webhook] SELL order placed and recorded for "${fyers_name}"`);
      } else {
        errors.push({ chartink_name: chartinkName, fyers_name, details: result.details });
        console.error(`[Chartink Sell Webhook] Order FAILED for "${fyers_name}":`, result.details);
      }
    } catch (err) {
      console.error(`[Chartink Sell Webhook] Error processing "${chartinkName}":`, err.message);
      errors.push({ chartink_name: chartinkName, reason: err.message });
    }
  });

  await Promise.all(tradePromises);

  const summary = {
    scan_name: alertLabel,
    triggered_at,
    total: stockList.length,
    traded,
    skipped,
    errors
  };

  console.log('[Chartink Sell Webhook] Done:', summary);
  return summary;
};

module.exports = { processChartinkSellWebhook };
