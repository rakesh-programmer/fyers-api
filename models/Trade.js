const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema(
  {
    watchlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Watchlist',
      required: true
    },
    chartink_name: {
      type: String,
      required: true,
      trim: true
    },
    fyers_name: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true
    },
    scan_name: {
      type: String,
      default: ''
    },
    triggered_at: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Trade', tradeSchema);
