const { fyersModel, fyersDataSocket } = require('fyers-api-v3');
const crypto = require('crypto');
const fs = require('fs');

const APP_ID = process.env.FYERS_APP_ID;

const SYMBOL = 'NSE:WIPRO-EQ';
const QUANTITY = 1;
const TARGET_PROFIT_PERCENTAGE = 0.1;
const STOP_LOSS_PERCENTAGE = 0.1;
const CHECK_INTERVAL_MS = 10000;

let isTradeActive = false;
let entryPrice = 0;
let latestPrice = 0;
let priceTrackerInterval = null;
let currentTrackingLogFile = null;

const fyers = new fyersModel();

let dataSocket = {
  LiteMode: 'LiteMode',
  connect: () => {},
  mode: () => {},
  on: () => {},
  subscribe: () => {},
  unsubscribe: () => {}
};

const applySocketListeners = () => {
  dataSocket.on('connect', () => {
    console.log(`WebSocket Connected. Subscribing to ${SYMBOL}...`);
    dataSocket.subscribe([SYMBOL]);
    dataSocket.mode(dataSocket.LiteMode);
  });

  dataSocket.on('message', async (message) => {
    if (!isTradeActive) return;

    const tickData = message?.data?.[0];
    if (tickData && tickData.symbol === SYMBOL) {
      latestPrice = tickData.ltp;
    }
  });

  dataSocket.on('error', (err) => console.error('WebSocket Error:', err));
};

const setupFyersServices = () => {
  const currentAccessToken = process.env.FYERS_ACCESS_TOKEN;
  const currentCombinedToken = `${APP_ID}:${currentAccessToken}`;

  if (APP_ID && currentAccessToken) {
    fyers.setAppId(APP_ID);
    fyers.setAccessToken(currentAccessToken);

    try {
      dataSocket = fyersDataSocket.getInstance(currentCombinedToken, './logs', false);
      applySocketListeners();
    } catch (error) {
      console.error('Failed to initialize Fyers DataSocket:', error.message);
    }

    return;
  }

  console.warn('FYERS_ACCESS_TOKEN is missing. Please login first at /login');
  throw new Error('Missing Access Token. Visit /login to authenticate first.');
};

const startTrackingInterval = () => {
  if (priceTrackerInterval) clearInterval(priceTrackerInterval);

  priceTrackerInterval = setInterval(async () => {
    if (!isTradeActive) return;

    if (latestPrice === 0) {
      console.log(`[${SYMBOL}] Waiting for active price stream... (LTP is 0)`);
      return;
    }

    if (entryPrice === 0) {
      try {
        const posResponse = await fyers.get_positions();

        if (posResponse && posResponse.netPositions) {
          const position = posResponse.netPositions.find((item) => item.symbol === SYMBOL);

          if (position && position.buyAvg > 0) {
            entryPrice = position.buyAvg;
            console.log(`[${SYMBOL}] Extracted true avg buy price: Rs${entryPrice} from positions`);
          } else {
            console.log(`[${SYMBOL}] Position not found in order book yet. Waiting...`);
            return;
          }
        } else {
          return;
        }
      } catch (error) {
        console.error('Failed to fetch positions for entry price:', error);
        return;
      }
    }

    const priceDifference = latestPrice - entryPrice;
    const percentageChange = (priceDifference / entryPrice) * 100;

    const logStatement = `[${SYMBOL}] LTP: Rs${latestPrice} | Avg Buy: Rs${entryPrice} | P&L: ${percentageChange.toFixed(3)}%`;
    console.log(logStatement);

    if (currentTrackingLogFile) {
      fs.appendFileSync(currentTrackingLogFile, `${new Date().toISOString()} - ${logStatement}\n`);
    }

    if (
      percentageChange >= TARGET_PROFIT_PERCENTAGE ||
      percentageChange <= -STOP_LOSS_PERCENTAGE
    ) {
      const exitLog = `Target reached (${percentageChange.toFixed(3)}%). Triggering square-off...`;
      console.log(exitLog);

      if (currentTrackingLogFile) {
        fs.appendFileSync(currentTrackingLogFile, `${new Date().toISOString()} - ${exitLog}\n`);
      }

      isTradeActive = false;
      clearInterval(priceTrackerInterval);

      try {
        const exitResponse = await fyers.place_order({
          disclosedQty: 0,
          limitPrice: 0,
          offlineOrder: false,
          productType: 'INTRADAY',
          qty: QUANTITY,
          side: -1,
          stopLoss: 0,
          stopPrice: 0,
          symbol: SYMBOL,
          takeProfit: 0,
          type: 2,
          validity: 'DAY'
        });

        console.log('Position closed successfully:', exitResponse);

        dataSocket.unsubscribe([SYMBOL]);
        entryPrice = 0;
        latestPrice = 0;
      } catch (error) {
        console.error('Failed to exit position:', error);
        isTradeActive = true;
        startTrackingInterval();
      }
    }
  }, CHECK_INTERVAL_MS);
};

const enterTradeService = async () => {
  console.log('enterTrade called');
  setupFyersServices();

  if (isTradeActive) {
    return { success: false, isAlreadyActive: true };
  }

  try {
    const orderResponse = await fyers.place_order({
      disclosedQty: 0,
      limitPrice: 0,
      offlineOrder: false,
      productType: 'INTRADAY',
      qty: QUANTITY,
      side: 1,
      stopLoss: 0,
      stopPrice: 0,
      symbol: SYMBOL,
      takeProfit: 0,
      type: 2,
      validity: 'DAY'
    });

    console.log('Order placed successfully:', orderResponse);

    if (orderResponse?.s === 'ok') {
      isTradeActive = true;

      const randomHash = crypto.randomBytes(4).toString('hex');
      const orderResponseLogFile = `order_response_${randomHash}.log`;
      fs.writeFileSync(orderResponseLogFile, JSON.stringify(orderResponse, null, 2));

      currentTrackingLogFile = `trade_tracker_${randomHash}.log`;
      fs.writeFileSync(currentTrackingLogFile, `--- Trade Tracking Started for ${SYMBOL} ---\n`);

      dataSocket.connect();
      startTrackingInterval();

      return { success: true, data: orderResponse };
    }

    return { success: false, details: orderResponse };
  } catch (error) {
    console.error('Failed to place order:', error);
    throw error;
  }
};

module.exports = {
  enterTradeService
};
