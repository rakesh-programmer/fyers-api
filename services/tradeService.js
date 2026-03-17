const { fyersModel, fyersDataSocket } = require('fyers-api-v3');
const crypto = require('crypto');
const fs = require('fs');

const APP_ID = process.env.FYERS_APP_ID;
const CHECK_INTERVAL_MS = 10000;

// --- Singleton Fyers HTTP client ---
const fyers = new fyersModel();

// --- Shared DataSocket (one per process) ---
let dataSocket = null;
// Map of symbol -> array of listener callbacks (for price updates)
const priceListeners = new Map();

const getOrCreateDataSocket = () => {
  if (dataSocket) return dataSocket;

  const currentAccessToken = process.env.FYERS_ACCESS_TOKEN;
  if (!APP_ID || !currentAccessToken) {
    throw new Error('Missing Access Token. Visit /login to authenticate first.');
  }

  fyers.setAppId(APP_ID);
  fyers.setAccessToken(currentAccessToken);

  const combinedToken = `${APP_ID}:${currentAccessToken}`;
  dataSocket = fyersDataSocket.getInstance(combinedToken, './logs', false);

  dataSocket.on('connect', () => {
    console.log('[DataSocket] Connected.');
    // Re-subscribe all active symbols
    const symbols = [...priceListeners.keys()];
    if (symbols.length > 0) {
      dataSocket.subscribe(symbols);
      dataSocket.mode(dataSocket.LiteMode);
    }
  });

  dataSocket.on('message', (message) => {
    const tickData = message?.data?.[0];
    if (!tickData) return;
    const listeners = priceListeners.get(tickData.symbol);
    if (listeners) {
      listeners.forEach((cb) => cb(tickData.ltp));
    }
  });

  dataSocket.on('error', (err) => console.error('[DataSocket] Error:', err));

  dataSocket.connect();
  return dataSocket;
};

// -----------------------------------------------------------------------
// executeTrade — place a BUY order and track until P&L target is hit
// targetPct and stopLossPct are percentages, e.g. 0.6 means 0.6%
// -----------------------------------------------------------------------
const executeTrade = async (symbol, quantity, targetPct = 0.6, stopLossPct = 0.6) => {
  const currentAccessToken = process.env.FYERS_ACCESS_TOKEN;
  if (!APP_ID || !currentAccessToken) {
    throw new Error('Missing Access Token. Visit /login to authenticate first.');
  }

  fyers.setAppId(APP_ID);
  fyers.setAccessToken(currentAccessToken);

  console.log(`[${symbol}] Placing BUY order — qty: ${quantity}`);

  const orderResponse = await fyers.place_order({
    disclosedQty: 0,
    limitPrice: 0,
    offlineOrder: false,
    productType: 'INTRADAY',
    qty: quantity,
    side: 1,
    stopLoss: 0,
    stopPrice: 0,
    symbol,
    takeProfit: 0,
    type: 2,
    validity: 'DAY'
  });

  console.log(`[${symbol}] Order response:`, orderResponse);

  if (orderResponse?.s !== 'ok') {
    return { success: false, symbol, details: orderResponse };
  }

  // Log files
  const randomHash = crypto.randomBytes(4).toString('hex');
  const orderLogFile = `order_response_${symbol.replace(/:/g, '_')}_${randomHash}.log`;
  const trackingLogFile = `trade_tracker_${symbol.replace(/:/g, '_')}_${randomHash}.log`;
  fs.writeFileSync(orderLogFile, JSON.stringify(orderResponse, null, 2));
  fs.writeFileSync(trackingLogFile, `--- Trade Tracking Started for ${symbol} ---\n`);

  // Per-trade state
  let entryPrice = 0;
  let latestPrice = 0;
  let isActive = true;
  let intervalId = null;

  // Register price listener for this symbol
  if (!priceListeners.has(symbol)) {
    priceListeners.set(symbol, []);
  }
  const onPrice = (ltp) => { latestPrice = ltp; };
  priceListeners.get(symbol).push(onPrice);

  // Subscribe via shared socket
  const socket = getOrCreateDataSocket();
  socket.subscribe([symbol]);
  socket.mode(socket.LiteMode);

  const stopTracking = async (reason) => {
    if (!isActive) return;
    isActive = false;
    clearInterval(intervalId);

    // Remove this listener
    const listeners = priceListeners.get(symbol) || [];
    const idx = listeners.indexOf(onPrice);
    if (idx !== -1) listeners.splice(idx, 1);
    if (listeners.length === 0) {
      priceListeners.delete(symbol);
      socket.unsubscribe([symbol]);
    }

    const exitLog = `[${symbol}] Exiting: ${reason}. Placing SELL order...`;
    console.log(exitLog);
    fs.appendFileSync(trackingLogFile, `${new Date().toISOString()} - ${exitLog}\n`);

    try {
      const exitResponse = await fyers.place_order({
        disclosedQty: 0,
        limitPrice: 0,
        offlineOrder: false,
        productType: 'INTRADAY',
        qty: quantity,
        side: -1,
        stopLoss: 0,
        stopPrice: 0,
        symbol,
        takeProfit: 0,
        type: 2,
        validity: 'DAY'
      });
      console.log(`[${symbol}] Position closed:`, exitResponse);
      fs.appendFileSync(trackingLogFile, `${new Date().toISOString()} - Exit response: ${JSON.stringify(exitResponse)}\n`);
    } catch (err) {
      console.error(`[${symbol}] Failed to exit position:`, err);
    }
  };

  intervalId = setInterval(async () => {
    if (!isActive) return;

    if (latestPrice === 0) {
      console.log(`[${symbol}] Waiting for price stream... (LTP = 0)`);
      return;
    }

    // Fetch entry price from positions if not yet set
    if (entryPrice === 0) {
      try {
        const posResponse = await fyers.get_positions();
        if (posResponse?.netPositions) {
          const position = posResponse.netPositions.find((p) => p.symbol === symbol);
          if (position && position.buyAvg > 0) {
            entryPrice = position.buyAvg;
            console.log(`[${symbol}] Entry price locked at Rs${entryPrice}`);
          } else {
            console.log(`[${symbol}] Waiting for position to appear in book...`);
            return;
          }
        }
      } catch (err) {
        console.error(`[${symbol}] Error fetching positions:`, err);
        return;
      }
    }

    const priceDiff = latestPrice - entryPrice;
    const pctChange = (priceDiff / entryPrice) * 100;
    const logLine = `[${symbol}] LTP: Rs${latestPrice} | AvgBuy: Rs${entryPrice} | P&L: ${pctChange.toFixed(3)}%`;
    console.log(logLine);
    fs.appendFileSync(trackingLogFile, `${new Date().toISOString()} - ${logLine}\n`);

    if (pctChange >= targetPct) {
      await stopTracking(`Profit target hit (${pctChange.toFixed(3)}% >= +${targetPct}%)`);
    } else if (pctChange <= -stopLossPct) {
      await stopTracking(`Stop loss hit (${pctChange.toFixed(3)}% <= -${stopLossPct}%)`);
    }
  }, CHECK_INTERVAL_MS);

  return { success: true, symbol, data: orderResponse };
};

// -----------------------------------------------------------------------
// Backward-compatible wrapper used by the existing /api/trade/enter route
// -----------------------------------------------------------------------
const LEGACY_SYMBOL = 'NSE:WIPRO-EQ';
const LEGACY_QTY = 1;

const enterTradeService = async () => {
  console.log('enterTrade called (legacy)');
  return executeTrade(LEGACY_SYMBOL, LEGACY_QTY, 0.1, 0.1);
};

module.exports = {
  enterTradeService,
  executeTrade
};
