const { fyersModel, fyersDataSocket } = require('fyers-api-v3');
const crypto = require('crypto');
const fs = require('fs');

const APP_ID = process.env.FYERS_APP_ID;
const CHECK_INTERVAL_MS = 10000;

// --- Singleton Fyers HTTP client ---
const fyers = new fyersModel();

// --- Shared DataSocket (one per process) ---
let dataSocket = null;
// Map of symbol -> array of price listener callbacks
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
// executeTrade — place an order and track until P&L target is hit
//
// side   : 1 = BUY (long),  -1 = SELL (short)
// targetPct / stopLossPct : percentages (e.g. 0.6 = 0.6%)
//
// For a BUY  : profit when price rises (+targetPct), loss when falls (-slPct)
// For a SELL : profit when price falls (-targetPct), loss when rises (+slPct)
//   exit side is the opposite of entry side
// -----------------------------------------------------------------------
const executeTrade = async (symbol, quantity, targetPct = 0.6, stopLossPct = 0.6, side = 1) => {
  const currentAccessToken = process.env.FYERS_ACCESS_TOKEN;
  if (!APP_ID || !currentAccessToken) {
    throw new Error('Missing Access Token. Visit /login to authenticate first.');
  }

  fyers.setAppId(APP_ID);
  fyers.setAccessToken(currentAccessToken);

  const direction = side === 1 ? 'BUY' : 'SELL';
  console.log(`[${symbol}] Placing ${direction} order — qty: ${quantity}`);

  const orderResponse = await fyers.place_order({
    disclosedQty: 0,
    limitPrice: 0,
    offlineOrder: false,
    productType: 'INTRADAY',
    qty: quantity,
    side,                 // 1 = BUY, -1 = SELL
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
  fs.writeFileSync(trackingLogFile, `--- ${direction} Trade Tracking Started for ${symbol} ---\n`);

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

    const exitSide = side === 1 ? -1 : 1;   // BUY trade exits via SELL, SELL trade exits via BUY
    const exitDirection = exitSide === 1 ? 'BUY' : 'SELL';
    const exitLog = `[${symbol}] Exiting (${reason}). Placing ${exitDirection} order...`;
    console.log(exitLog);
    fs.appendFileSync(trackingLogFile, `${new Date().toISOString()} - ${exitLog}\n`);

    try {
      const exitResponse = await fyers.place_order({
        disclosedQty: 0,
        limitPrice: 0,
        offlineOrder: false,
        productType: 'INTRADAY',
        qty: quantity,
        side: exitSide,
        stopLoss: 0,
        stopPrice: 0,
        symbol,
        takeProfit: 0,
        type: 2,
        validity: 'DAY'
      });
      console.log(`[${symbol}] Position closed:`, exitResponse);
      fs.appendFileSync(
        trackingLogFile,
        `${new Date().toISOString()} - Exit response: ${JSON.stringify(exitResponse)}\n`
      );
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
          if (position) {
            // buyAvg for long positions, sellAvg for short positions
            const avgPrice = side === 1 ? position.buyAvg : position.sellAvg;
            if (avgPrice > 0) {
              entryPrice = avgPrice;
              console.log(`[${symbol}] Entry price locked at Rs${entryPrice} (${direction})`);
            } else {
              console.log(`[${symbol}] Waiting for position to appear in book...`);
              return;
            }
          } else {
            console.log(`[${symbol}] Position not found yet. Waiting...`);
            return;
          }
        }
      } catch (err) {
        console.error(`[${symbol}] Error fetching positions:`, err);
        return;
      }
    }

    const priceDiff = latestPrice - entryPrice;
    // For BUY  : positive priceDiff = profit
    // For SELL : negative priceDiff = profit → invert percentage for sell
    const pctChange = (priceDiff / entryPrice) * 100 * side;

    const logLine = `[${symbol}] LTP: Rs${latestPrice} | Entry: Rs${entryPrice} | P&L: ${pctChange.toFixed(3)}% (${direction})`;
    console.log(logLine);
    fs.appendFileSync(trackingLogFile, `${new Date().toISOString()} - ${logLine}\n`);

    if (pctChange >= targetPct) {
      await stopTracking(`Profit target hit (${pctChange.toFixed(3)}% >= +${targetPct}%)`);
    } else if (pctChange <= -stopLossPct) {
      await stopTracking(`Stop loss hit (${pctChange.toFixed(3)}% <= -${stopLossPct}%)`);
    }
  }, CHECK_INTERVAL_MS);

  return { success: true, symbol, direction, data: orderResponse };
};

// -----------------------------------------------------------------------
// Backward-compatible wrapper for the existing /api/trade/enter route
// -----------------------------------------------------------------------
const LEGACY_SYMBOL = 'NSE:WIPRO-EQ';
const LEGACY_QTY = 1;

const enterTradeService = async () => {
  console.log('enterTrade called (legacy)');
  return executeTrade(LEGACY_SYMBOL, LEGACY_QTY, 0.1, 0.1, 1);
};

module.exports = {
  enterTradeService,
  executeTrade
};
