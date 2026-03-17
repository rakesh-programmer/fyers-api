const Watchlist = require('../models/Watchlist');
const Trade = require('../models/Trade');
const { executeTrade } = require('./tradeService');
const { logWebhookAccepted } = require('./tradeLogService');

const TARGET_PCT = 0.6;
const STOP_LOSS_PCT = 0.6;
const SELL_SIDE = -1;

const processChartinkSellWebhook = async (payload) => {
  const { stocks, scan_name, triggered_at, alert_name } = payload;

  if (!stocks) throw new Error('Missing "stocks" field in payload');

  const stockList = stocks.split(',').map((s) => s.trim()).filter(Boolean);
  const alertLabel = alert_name || scan_name;

  console.log(`[Chartink Sell Webhook] Alert: "${alertLabel}" at ${triggered_at}`);
  console.log(`[Chartink Sell Webhook] Stocks: ${stockList.join(', ')}`);

  // --- Log: WEBHOOK_ACCEPTED ---
  await logWebhookAccepted({
    scan_name: alertLabel,
    triggered_at,
    stocks: stockList,
    direction: 'SELL'
  });

  const traded = [];
  const skipped = [];
  const errors = [];

  const tradePromises = stockList.map(async (chartinkName) => {
    try {
      const watchlistEntry = await Watchlist.findOne({ chartink_name: chartinkName });

      if (!watchlistEntry) {
        console.log(`[Chartink Sell Webhook] "${chartinkName}" not in watchlist — skipping.`);
        skipped.push({ chartink_name: chartinkName, reason: 'Not in watchlist' });
        return;
      }

      const { _id: watchlistId, fyers_name, quantity } = watchlistEntry;

      const alreadyTraded = await Trade.findOne({ watchlistId });
      if (alreadyTraded) {
        console.log(`[Chartink Sell Webhook] "${chartinkName}" already traded today — skipping.`);
        skipped.push({ chartink_name: chartinkName, reason: 'Already traded today' });
        return;
      }

      console.log(`[Chartink Sell Webhook] "${chartinkName}" → Fyers: "${fyers_name}", Qty: ${quantity}`);

      const result = await executeTrade(
        fyers_name,
        quantity,
        TARGET_PCT,
        STOP_LOSS_PCT,
        SELL_SIDE,
        { chartink_name: chartinkName, scan_name: alertLabel, triggered_at }
      );

      if (result.success) {
        await Trade.create({ watchlistId, chartink_name: chartinkName, fyers_name, quantity, scan_name: alertLabel, triggered_at });
        traded.push({ chartink_name: chartinkName, fyers_name, quantity });
        console.log(`[Chartink Sell Webhook] SELL order placed for "${fyers_name}"`);
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

  const summary = { scan_name: alertLabel, triggered_at, total: stockList.length, traded, skipped, errors };
  console.log('[Chartink Sell Webhook] Done:', summary);
  return summary;
};

module.exports = { processChartinkSellWebhook };
