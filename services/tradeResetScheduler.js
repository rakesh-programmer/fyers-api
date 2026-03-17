const cron = require('node-cron');
const Trade = require('../models/Trade');

/**
 * Schedules a daily job at 8:00 AM (IST) to clear all Trade records.
 * This resets the "one trade per stock per day" policy each morning.
 *
 * Cron syntax: '0 8 * * *'
 *   ┌── second (optional)
 *   │ ┌── minute  = 0
 *   │ │ ┌── hour   = 8
 *   │ │ │ ┌── day of month = * (every day)
 *   │ │ │ │ ┌── month = * (every month)
 *   │ │ │ │ │ ┌── day of week = * (every day)
 *
 * node-cron runs in server's local timezone by default.
 * Set TZ=Asia/Kolkata in your .env / environment to ensure IST.
 */
const scheduleDailyTradeReset = () => {
  cron.schedule(
    '0 8 * * *',
    async () => {
      try {
        const result = await Trade.deleteMany({});
        console.log(
          `[TradeReset] Daily reset complete at ${new Date().toISOString()} — ${result.deletedCount} trade(s) cleared.`
        );
      } catch (err) {
        console.error('[TradeReset] Failed to reset trades collection:', err.message);
      }
    },
    {
      timezone: 'Asia/Kolkata'
    }
  );

  console.log('[TradeReset] Daily reset cron scheduled — runs every day at 08:00 AM IST.');
};

module.exports = { scheduleDailyTradeReset };
