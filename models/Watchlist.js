const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema(
  {
    fyers_name: {
      type: String,
      required: true,
      trim: true
    },
    chartink_name: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Watchlist', watchlistSchema);
