const mongoose = require('mongoose');

const EVENT_TYPES = {
  WEBHOOK_ACCEPTED: 'WEBHOOK_ACCEPTED',
  TRADE_EXECUTED: 'TRADE_EXECUTED',
  TRADE_EXITED: 'TRADE_EXITED'
};

const tradeLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: Object.values(EVENT_TYPES),
      required: true,
      index: true
    },
    chartink_name: { type: String, default: '' },
    fyers_name: { type: String, default: '' },
    direction: { type: String, enum: ['BUY', 'SELL', ''], default: '' },
    scan_name: { type: String, default: '' },
    triggered_at: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 },       // entry price for EXECUTED, exit price for EXITED
    pnl_pct: { type: Number, default: null },  // filled for TRADE_EXITED
    reason: { type: String, default: '' },     // e.g. "Profit target hit" / "Stop loss hit" / skip reason
    details: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

const TradeLog = mongoose.model('TradeLog', tradeLogSchema);

module.exports = { TradeLog, EVENT_TYPES };
