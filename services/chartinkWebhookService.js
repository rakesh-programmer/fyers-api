const Watchlist = require('../models/Watchlist');
const Trade = require('../models/Trade');
const { executeTrade } = require('./tradeService');

const TARGET_PCT = 0.6;
const STOP_LOSS_PCT = 0.6;

/**
 * Processes a Chartink webhook payload.
 * - Looks up each stock in Watchlist by chartink_name
 * - Skips if already traded today (Trade record exists for that watchlistId)
 * - Places order and records a Trade entry if not yet traded
 */
const processChartinkWebhook = async (payload) => {
  const { stocks, scan_name, triggered_at, alert_name } = payload;

  if (!stocks) {
    throw new Error('Missing "stocks" field in payload');
  }

  const stockList = stocks
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const alertLabel = alert_name || scan_name;
  console.log(`[Chartink Webhook] Alert: "${alertLabel}" at ${triggered_at}`);
  console.log(`[Chartink Webhook] Stocks: ${stockList.join(', ')}`);

  const traded = [];
  const skipped = [];
  const errors = [];

  const tradePromises = stockList.map(async (chartinkName) => {
    try {
      // 1. Find matching watchlist entry
      const watchlistEntry = await Watchlist.findOne({ chartink_name: chartinkName });

      if (!watchlistEntry) {
        console.log(`[Chartink Webhook] "${chartinkName}" not in watchlist — skipping.`);
        skipped.push({ chartink_name: chartinkName, reason: 'Not in watchlist' });
        return;
      }

      const { _id: watchlistId, fyers_name, quantity } = watchlistEntry;

      // 2. Check if already traded today
      const alreadyTraded = await Trade.findOne({ watchlistId });

      if (alreadyTraded) {
        console.log(
          `[Chartink Webhook] "${chartinkName}" already traded today (Trade ID: ${alreadyTraded._id}) — skipping.`
        );
        skipped.push({ chartink_name: chartinkName, reason: 'Already traded today' });
        return;
      }

      console.log(
        `[Chartink Webhook] Processing "${chartinkName}" → Fyers: "${fyers_name}", Qty: ${quantity}`
      );

      // 3. Place order
      const result = await executeTrade(fyers_name, quantity, TARGET_PCT, STOP_LOSS_PCT);

      if (result.success) {
        // 4. Record the trade so it won't be repeated today
        await Trade.create({
          watchlistId,
          chartink_name: chartinkName,
          fyers_name,
          quantity,
          scan_name: alertLabel,
          triggered_at
        });

        traded.push({ chartink_name: chartinkName, fyers_name, quantity });
        console.log(`[Chartink Webhook] Order placed and recorded for "${fyers_name}"`);
      } else {
        errors.push({ chartink_name: chartinkName, fyers_name, details: result.details });
        console.error(`[Chartink Webhook] Order FAILED for "${fyers_name}":`, result.details);
      }
    } catch (err) {
      console.error(`[Chartink Webhook] Error processing "${chartinkName}":`, err.message);
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

  console.log('[Chartink Webhook] Done:', summary);
  return summary;
};

module.exports = { processChartinkWebhook };
